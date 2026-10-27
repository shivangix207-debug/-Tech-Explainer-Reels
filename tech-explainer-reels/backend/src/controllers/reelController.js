const Reel = require("../models/Reel");
const Category = require("../models/Category");
const Progress = require("../models/Progress");
const Comment = require("../models/Comment");
const Bookmark = require("../models/Bookmark");
const QuizResult = require("../models/QuizResult");
const ViewEvent = require("../models/ViewEvent");
const Report = require("../models/Report");
const { moderateLesson, isTrustedCreator, cfg: modCfg } = require("../utils/moderation");
const crypto = require("crypto");
const { asyncHandler } = require("../middleware/errorHandler");
const { canViewReel, isPubliclyVisible } = require("../middleware/auth");
const { registerDailyActivity, addXp, evaluateBadges, XP_REEL_WATCH } = require("../utils/gamification");
const {
  isValidId, escapeRegex, isLocalVideoUrl, isLocalThumbUrl, isHttpUrl, removeUploadedFile, hashUploadedFile, httpError,
} = require("../utils/helpers");

const SKILLS = ["beginner", "intermediate", "advanced"];
const COMPLETE_AT = 0.9; // a lesson counts as completed once 90% has been watched

// Public = published, or scheduled and due.
const visibilityFilter = () => ({
  $or: [{ status: "published" }, { status: { $exists: false }, isPublished: true }, { status: "scheduled", scheduledAt: { $lte: new Date() } }],
});

const LIST_FIELDS = "-quiz -transcript -interviewQA -keyTakeaways";

// @route GET /api/reels  ?search=&category=&sort=&skillLevel=&tag=&page=&limit=
const getReels = asyncHandler(async (req, res) => {
  const { search, category, sort = "latest", skillLevel, tag } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 100);

  const and = [visibilityFilter()];
  if (category) {
    if (!isValidId(category)) throw httpError(400, "Invalid category id");
    and.push({ category });
  }
  if (skillLevel) {
    if (!SKILLS.includes(skillLevel)) throw httpError(400, "Invalid skill level");
    and.push({ skillLevel });
  }
  if (tag) and.push({ tags: String(tag).toLowerCase() });
  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(String(search).trim().slice(0, 80)), "i");
    and.push({ $or: [{ title: rx }, { description: rx }, { tags: rx }, { learningObjective: rx }] });
  }
  const filter = { $and: and };

  let sortOption = { createdAt: -1 };
  if (sort === "trending") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    and.push({ createdAt: { $gte: sevenDaysAgo } });
    sortOption = { views: -1 };
  }
  if (sort === "popular") sortOption = { views: -1 };
  if (sort === "most_liked") sortOption = { likes: -1 };

  const [reels, total] = await Promise.all([
    Reel.find(filter).select(LIST_FIELDS).populate("category", "name slug color icon").populate("uploadedBy", "name")
      .sort(sortOption).skip((page - 1) * limit).limit(limit),
    Reel.countDocuments(filter),
  ]);

  res.json({ success: true, reels, pagination: { total, page, pages: Math.ceil(total / limit) } });
});

// @route GET /api/reels/mine  (creator/admin) - own lessons in every status
const getMyReels = asyncHandler(async (req, res) => {
  const reels = await Reel.find({ uploadedBy: req.user._id }).select(LIST_FIELDS)
    .populate("category", "name slug color").sort({ createdAt: -1 });
  const published = reels.filter((r) => r.status === "published").length;
  const rejected = reels.filter((r) => r.status === "rejected").length;
  const trust = { trusted: await isTrustedCreator(req.user), published, rejected, needed: modCfg().trustMinApproved };
  res.json({ success: true, reels, trust });
});

// @route GET /api/reels/:id
const getReelById = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.id).populate("category", "name slug color icon").populate("uploadedBy", "name");

  // Unpublished lessons look like they don't exist to everyone except the owner/admin.
  if (!reel || !canViewReel(reel, req.user)) return res.status(404).json({ success: false, message: "Reel not found" });

  const obj = reel.toJSON(); // NOTE: opening a page no longer counts as a view - see recordView

  const related = await Reel.find({ $and: [visibilityFilter(), { category: reel.category?._id, _id: { $ne: reel._id } }] })
    .limit(6).select("title thumbnailUrl duration views likes skillLevel videoSource");

  let myProgress = null;
  if (req.user) myProgress = await Progress.findOne({ user: req.user._id, reel: reel._id }).select("watchedSeconds completed");

  res.json({ success: true, reel: obj, related, myProgress });
});

// Validates and normalises the editable lesson fields. `partial` = update (only validate what's present).
const buildFields = async (body, user, partial) => {
  const out = {};
  const str = (k, min, max) => {
    if (body[k] === undefined) { if (!partial && min) throw httpError(400, `${k} is required`); return; }
    const v = String(body[k]).trim();
    if (v.length < min) throw httpError(400, `${k} must be at least ${min} characters`);
    if (v.length > max) throw httpError(400, `${k} must be at most ${max} characters`);
    out[k] = v;
  };
  str("title", 3, 120);
  str("description", 10, 600);
  str("transcript", 0, 20000);
  str("learningObjective", 0, 300);

  if (body.category !== undefined || !partial) {
    if (!isValidId(body.category)) throw httpError(400, "A valid category is required");
    if (!(await Category.exists({ _id: body.category }))) throw httpError(400, "Category does not exist");
    out.category = body.category;
  }
  if (body.skillLevel !== undefined) {
    if (!SKILLS.includes(body.skillLevel)) throw httpError(400, "Difficulty must be beginner, intermediate or advanced");
    out.skillLevel = body.skillLevel;
  }
  if (body.tags !== undefined) {
    const arr = Array.isArray(body.tags) ? body.tags : String(body.tags).split(",");
    out.tags = [...new Set(arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 10).map((t) => t.slice(0, 30));
  }
  if (body.keyTakeaways !== undefined) {
    out.keyTakeaways = (Array.isArray(body.keyTakeaways) ? body.keyTakeaways : String(body.keyTakeaways).split("\n"))
      .map((t) => String(t).trim()).filter(Boolean).slice(0, 10);
  }
  if (body.duration !== undefined) {
    const d = Number(body.duration);
    if (!Number.isFinite(d) || d < 1 || d > 36000) throw httpError(400, "Duration must be between 1 and 36000 seconds");
    out.duration = Math.round(d);
  }

  if (body.videoUrl !== undefined || !partial) {
    const u = body.videoUrl;
    if (isLocalVideoUrl(u)) { out.videoUrl = u; out.videoSource = "uploaded"; out.videoFile = u; }
    else if (user.role === "admin" && isHttpUrl(u)) { out.videoUrl = u; out.videoSource = "external"; }
    else throw httpError(400, user.role === "admin" ? "Upload a video file or provide a valid http(s) video URL" : "Upload a video file first (supported: MP4, WebM, MOV)");
  }
  if (body.thumbnailUrl !== undefined && body.thumbnailUrl !== "") {
    if (isLocalThumbUrl(body.thumbnailUrl) || (user.role === "admin" && isHttpUrl(body.thumbnailUrl))) out.thumbnailUrl = body.thumbnailUrl;
    else throw httpError(400, "Invalid thumbnail URL");
  } else if (body.thumbnailUrl === "") out.thumbnailUrl = "";
  return out;
};

// @route POST /api/reels (creator|admin). Creators' lessons always start as "pending" review.
const createReel = asyncHandler(async (req, res) => {
  const fields = await buildFields(req.body, req.user, false);
  let status = "pending";
  let scheduledAt = null;
  if (req.user.role === "admin") {
    status = ["draft", "pending", "published", "scheduled"].includes(req.body.status) ? req.body.status : "published";
    if (status === "scheduled") {
      scheduledAt = new Date(req.body.scheduledAt);
      if (isNaN(scheduledAt)) throw httpError(400, "A valid schedule date is required");
    }
  }
  const reel = new Reel({ ...fields, status, scheduledAt, uploadedBy: req.user._id });
  if (req.user.role === "admin") reel.autoDecision = "admin";
  else {
    // Creators go through the moderation pipeline: screening -> reject / human review / auto-approve (trusted).
    reel.videoHash = await hashUploadedFile(fields.videoUrl);
    await moderateLesson(reel, req.user);
  }
  await reel.save();
  res.status(201).json({ success: true, reel });
});

// @route PUT /api/reels/:id (owner|admin)
const updateReel = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.id);
  if (!reel) throw httpError(404, "Reel not found");

  const isAdmin = req.user.role === "admin";
  if (!isAdmin && String(reel.uploadedBy) !== String(req.user._id)) throw httpError(403, "You can only edit your own lessons");

  const fields = await buildFields(req.body, req.user, true);
  const oldVideo = reel.videoUrl;
  const contentChanged = ["title", "description", "transcript", "videoUrl"].some((k) => fields[k] !== undefined && fields[k] !== reel[k]);
  Object.assign(reel, fields);

  if (isAdmin) {
    if (["draft", "pending", "published", "scheduled", "rejected"].includes(req.body.status)) reel.status = req.body.status;
    if (reel.status === "scheduled" && req.body.scheduledAt) reel.scheduledAt = new Date(req.body.scheduledAt);
  } else if (reel.status === "rejected" || contentChanged) {
    // after a rejection or a substantive edit the lesson is screened again (trusted + clean stays/goes live)
    if (fields.videoUrl && fields.videoUrl !== oldVideo) reel.videoHash = await hashUploadedFile(reel.videoUrl);
    await moderateLesson(reel, req.user);
  }
  await reel.save();
  if (fields.videoUrl && oldVideo !== reel.videoUrl && reel.videoSource !== "generated-slides") removeUploadedFile(oldVideo);
  res.json({ success: true, reel });
});

// Removes a lesson and everything that hangs off it.
const purgeReel = async (reel) => {
  await Promise.all([
    Comment.deleteMany({ reel: reel._id }), Progress.deleteMany({ reel: reel._id }),
    Bookmark.deleteMany({ reel: reel._id }), QuizResult.deleteMany({ reel: reel._id }), ViewEvent.deleteMany({ reel: reel._id }), Report.deleteMany({ reel: reel._id }),
  ]);
  if (reel.videoSource === "uploaded") { removeUploadedFile(reel.videoUrl); removeUploadedFile(reel.thumbnailUrl); }
  await reel.deleteOne();
};

// @route DELETE /api/reels/:id (owner|admin)
const deleteReel = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.id);
  if (!reel) throw httpError(404, "Reel not found");
  if (req.user.role !== "admin" && String(reel.uploadedBy) !== String(req.user._id)) throw httpError(403, "You can only delete your own lessons");
  await purgeReel(reel);
  res.json({ success: true, message: "Reel deleted" });
});

// @route POST /api/reels/:id/view - called by the player after ~3s of real playback.
// Counts once per viewer (user id, or hashed IP+browser for guests) per 30 minutes.
const recordView = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.id).select("status scheduledAt isPublished uploadedBy");
  if (!reel || !isPubliclyVisible(reel)) return res.json({ success: true, counted: false });
  const viewer = req.user ? `u:${req.user._id}` : `ip:${crypto.createHash("sha1").update(`${req.ip}|${req.get("user-agent") || ""}`).digest("hex").slice(0, 16)}`;
  let counted = false;
  try {
    const r = await ViewEvent.updateOne({ reel: reel._id, viewer }, { $setOnInsert: { reel: reel._id, viewer, createdAt: new Date() } }, { upsert: true });
    counted = !!r.upsertedCount;
  } catch (e) { if (e.code !== 11000) throw e; } // duplicate key from a parallel request = already counted
  if (counted) await Reel.updateOne({ _id: reel._id }, { $inc: { views: 1 } });
  res.json({ success: true, counted });
});

// @route POST /api/reels/:id/report  { reason, details? } - community reporting.
// REPORT_THRESHOLD distinct reporters automatically hide the lesson and queue it for an admin.
const REPORT_REASONS = ["spam", "inappropriate", "misleading", "copyright", "other"];
const reportReel = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const { reason, details } = req.body;
  if (!REPORT_REASONS.includes(reason)) throw httpError(400, "Choose a reason for the report");
  const reel = await Reel.findById(req.params.id);
  if (!reel || !canViewReel(reel, req.user)) throw httpError(404, "Reel not found");
  if (String(reel.uploadedBy) === String(req.user._id)) throw httpError(400, "You can't report your own lesson");

  const r = await Report.updateOne({ reel: reel._id, user: req.user._id }, { $setOnInsert: { reel: reel._id, user: req.user._id, reason, details: String(details || "").slice(0, 300) } }, { upsert: true });
  if (!r.upsertedCount) return res.json({ success: true, alreadyReported: true, hidden: reel.status !== "published" });

  reel.reportCount = await Report.countDocuments({ reel: reel._id });
  let hidden = false;
  if (reel.reportCount >= modCfg().reportThreshold && reel.status === "published") {
    reel.status = "pending"; reel.autoDecision = "needs-review"; reel.risk = Math.max(reel.risk || 0, 70);
    reel.moderationNotes = [...(reel.moderationNotes || []), `Hidden automatically: reported by ${reel.reportCount} users`];
    hidden = true;
  }
  await reel.save();
  res.status(201).json({ success: true, hidden });
});

// @route PUT /api/reels/:id/like - atomic toggle, can never create duplicate likes
const toggleLike = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.id).select("likes status scheduledAt isPublished uploadedBy");
  if (!reel || !canViewReel(reel, req.user)) throw httpError(404, "Reel not found");

  const liked = reel.likes.some((id) => String(id) === String(req.user._id));
  // $addToSet / $pull are atomic and idempotent, so concurrent toggles can never create duplicate likes
  await Reel.updateOne({ _id: reel._id }, liked ? { $pull: { likes: req.user._id } } : { $addToSet: { likes: req.user._id } });
  const updated = await Reel.findById(reel._id).select("likes");
  res.json({ success: true, liked: !liked, likeCount: updated.likes.length });
});

// @route PUT /api/reels/:id/progress  { watchedSeconds }
// Completion is decided by the server (>= 90% watched), not claimed by the client.
const updateProgress = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.id).select("duration status scheduledAt isPublished uploadedBy");
  if (!reel || !canViewReel(reel, req.user)) throw httpError(404, "Reel not found");

  let watched = Number(req.body.watchedSeconds);
  if (!Number.isFinite(watched) || watched < 0) throw httpError(400, "watchedSeconds must be a non-negative number");
  watched = Math.min(Math.round(watched), reel.duration || watched);

  const existing = await Progress.findOne({ user: req.user._id, reel: reel._id });
  const wasCompleted = !!existing?.completed;
  const reached = reel.duration ? watched >= reel.duration * COMPLETE_AT : false;
  const completed = wasCompleted || reached;

  const progress = await Progress.findOneAndUpdate(
    { user: req.user._id, reel: reel._id },
    { watchedSeconds: wasCompleted ? Math.max(existing.watchedSeconds, watched) : watched, completed, lastWatchedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let gamification = null;
  if (completed && !wasCompleted) {
    const user = req.user;
    registerDailyActivity(user);
    addXp(user, XP_REEL_WATCH);
    const newBadges = await evaluateBadges(user);
    await user.save();
    gamification = { xpGained: XP_REEL_WATCH, xp: user.xp, level: user.level, streak: user.streak, newBadges };
  }
  res.json({ success: true, progress, gamification });
});

module.exports = { getReels, getMyReels, getReelById, createReel, updateReel, deleteReel, toggleLike, updateProgress, recordView, reportReel, purgeReel, visibilityFilter };
