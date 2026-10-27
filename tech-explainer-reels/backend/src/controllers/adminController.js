const User = require("../models/User");
const Reel = require("../models/Reel");
const Category = require("../models/Category");
const Comment = require("../models/Comment");
const QuizResult = require("../models/QuizResult");
const Progress = require("../models/Progress");
const { asyncHandler } = require("../middleware/errorHandler");
const { purgeReel } = require("./reelController");
const Report = require("../models/Report");
const { cfg: modCfg } = require("../utils/moderation");
const { isValidId, escapeRegex, httpError } = require("../utils/helpers");
const ROLES = ["user", "creator", "admin"];
const REEL_STATUSES = ["draft", "pending", "scheduled", "published", "rejected"];

// @route GET /api/admin/analytics?days=14
const getAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 90);

  const [totalUsers, totalReels, totalCategories, totalComments, totalQuizzes, statusAgg, roleAgg] = await Promise.all([
    User.countDocuments(),
    Reel.countDocuments(),
    Category.countDocuments(),
    Comment.countDocuments(),
    QuizResult.countDocuments(),
    Reel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
  ]);
  const [autoApproved, flagged, spotChecks] = await Promise.all([
    Reel.countDocuments({ autoDecision: "auto-approved" }),
    Reel.countDocuments({ status: "pending", $or: [{ risk: { $gte: modCfg().reviewRisk } }, { reportCount: { $gt: 0 } }] }),
    Reel.countDocuments({ status: "published", needsAudit: true }),
  ]);
  const reelsByStatus = Object.fromEntries(statusAgg.map((x) => [x._id, x.count]));
  const usersByRole = Object.fromEntries(roleAgg.map((x) => [x._id, x.count]));

  const mostViewedReels = await Reel.find().sort({ views: -1 }).limit(5).select("title views likes category").populate("category", "name");

  // Group in the database, then join titles with one extra query (portable, no $lookup/$avg needed).
  const attemptGroups = await QuizResult.aggregate([
    { $group: { _id: "$reel", attempts: { $sum: 1 }, totalPct: { $sum: "$percentage" } } },
    { $sort: { attempts: -1 } },
    { $limit: 5 },
  ]);
  const quizReels = await Reel.find({ _id: { $in: attemptGroups.map((g) => g._id) } }).select("title");
  const titleById = Object.fromEntries(quizReels.map((r) => [String(r._id), r.title]));
  const mostAttemptedQuizzes = attemptGroups
    .filter((g) => titleById[String(g._id)])
    .map((g) => ({ _id: g._id, attempts: g.attempts, avgScore: Math.round(g.totalPct / g.attempts), reel: { title: titleById[String(g._id)] } }));

  const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select("name email role createdAt");

  // Signups per day for the selected range (adjustable via ?days=)
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - days);
  const recentSignups = await User.find({ createdAt: { $gte: rangeStart } }).select("createdAt").lean();
  const perDay = {};
  for (const u of recentSignups) { const k = new Date(u.createdAt).toISOString().slice(0, 10); perDay[k] = (perDay[k] || 0) + 1; }
  const signupTrend = Object.keys(perDay).sort().map((k) => ({ _id: k, count: perDay[k] }));

  res.json({
    success: true,
    totals: { totalUsers, totalReels, totalCategories, totalComments, totalQuizzes, pendingReview: reelsByStatus.pending || 0, autoApproved, flagged, spotChecks },
    reelsByStatus,
    usersByRole,
    mostViewedReels,
    mostAttemptedQuizzes,
    recentUsers,
    signupTrend,
    rangeDays: days,
  });
});

// @route GET /api/admin/reels  ?status=&search=  - every lesson in every status (moderation queue)
const listAllReels = asyncHandler(async (req, res) => {
  const filter = {}, { status, flagged, spotcheck, search } = req.query;
  if (status) {
    if (!REEL_STATUSES.includes(status)) throw httpError(400, "Invalid status");
    filter.status = status;
  }
  // "flagged" = needs a human: screening risk is high or users reported it
  if (flagged) { filter.status = "pending"; filter.$or = [{ risk: { $gte: modCfg().reviewRisk } }, { reportCount: { $gt: 0 } }]; }
  if (spotcheck) { filter.status = "published"; filter.needsAudit = true; }
  if (search) filter.title = new RegExp(escapeRegex(String(search).slice(0, 80)), "i");
  // review queues: riskiest first, then oldest first; everything else newest first
  const queue = filter.status === "pending" || flagged || spotcheck;
  const reels = await Reel.find(filter).select("-quiz -transcript -interviewQA")
    .populate("category", "name color").populate("uploadedBy", "name email role trusted")
    .sort(queue ? { risk: -1, createdAt: 1 } : { createdAt: -1 }).limit(300);
  res.json({ success: true, reels });
});

// @route POST /api/admin/reels/approve-clean - one click: publish every pending lesson that screening found clean and nobody reported
const approveClean = asyncHandler(async (req, res) => {
  const filter = { status: "pending", risk: { $lt: modCfg().reviewRisk }, reportCount: 0 };
  const r = await Reel.updateMany(filter, { $set: { status: "published", autoDecision: "admin", reviewedBy: req.user._id, reviewedAt: new Date(), rejectionReason: "" } });
  res.json({ success: true, approved: r.modifiedCount ?? r.nModified ?? 0 });
});

// @route PUT /api/admin/reels/:id/status  { status: "published"|"rejected"|"draft"|"pending", reason? }
const moderateReel = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const { status, reason } = req.body;
  if (!["published", "rejected", "draft", "pending"].includes(status)) throw httpError(400, "Invalid status");
  const reel = await Reel.findById(req.params.id);
  if (!reel) throw httpError(404, "Reel not found");
  reel.status = status;
  reel.rejectionReason = status === "rejected" ? String(reason || "").trim().slice(0, 300) : "";
  reel.reviewedBy = req.user._id;
  reel.reviewedAt = new Date();
  reel.needsAudit = false;
  reel.autoDecision = "admin";
  if (status === "published") { await Report.deleteMany({ reel: reel._id }); reel.reportCount = 0; } // admin cleared the reports
  await reel.save();
  res.json({ success: true, reel });
});

// @route PUT /api/admin/reels/bulk  { ids: [...], action: "publish"|"unpublish"|"reject"|"delete" }
const bulkReelAction = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every(isValidId)) {
    return res.status(400).json({ success: false, message: "Select between 1 and 200 valid reels" });
  }
  const reels = await Reel.find({ _id: { $in: ids } });
  if (action === "delete") {
    for (const r of reels) await purgeReel(r);
    return res.json({ success: true, message: `Deleted ${reels.length} reel(s)` });
  }
  const map = { publish: "published", unpublish: "draft", reject: "rejected" };
  if (!map[action]) return res.status(400).json({ success: false, message: "Unknown bulk action" });
  await Promise.all(reels.map((r) => { r.status = map[action]; r.reviewedBy = req.user._id; r.reviewedAt = new Date(); return r.save(); }));
  res.json({ success: true, message: `Updated ${reels.length} reel(s)` });
});

// @route GET /api/admin/reels/:id/analytics - per-reel watch time, drop-off, quiz pass rate
const getReelAnalytics = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.id);
  if (!reel) return res.status(404).json({ success: false, message: "Reel not found" });

  const [progressDocs, quizResults] = await Promise.all([
    Progress.find({ reel: reel._id }),
    QuizResult.find({ reel: reel._id }),
  ]);

  const totalWatchSeconds = progressDocs.reduce((sum, p) => sum + (p.watchedSeconds || 0), 0);
  const completedCount = progressDocs.filter((p) => p.completed).length;
  const viewers = progressDocs.length;

  // Approximate drop-off point: average watched-seconds among those who did NOT complete
  const incomplete = progressDocs.filter((p) => !p.completed);
  const avgDropOffSeconds = incomplete.length
    ? Math.round(incomplete.reduce((sum, p) => sum + (p.watchedSeconds || 0), 0) / incomplete.length)
    : reel.duration || 0;

  const passedQuizzes = quizResults.filter((q) => q.percentage >= 80).length;
  const quizPassRate = quizResults.length ? Math.round((passedQuizzes / quizResults.length) * 100) : 0;

  res.json({
    success: true,
    analytics: {
      reelId: reel._id,
      title: reel.title,
      duration: reel.duration,
      viewers,
      completedCount,
      completionRate: viewers ? Math.round((completedCount / viewers) * 100) : 0,
      totalWatchSeconds,
      avgWatchSeconds: viewers ? Math.round(totalWatchSeconds / viewers) : 0,
      avgDropOffSeconds,
      quizAttempts: quizResults.length,
      quizPassRate,
    },
  });
});

// @route GET /api/admin/users
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, users: users.map((u) => u.toSafeObject()) });
});

// @route PUT /api/admin/users/:id
const updateUser = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "User not found");
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const { role, isActive, trusted } = req.body;
  if (trusted !== undefined) user.trusted = !!trusted;
  const isSelf = String(user._id) === String(req.user._id);
  if (role !== undefined) {
    if (!ROLES.includes(role)) throw httpError(400, "Invalid role");
    if (isSelf && role !== "admin") throw httpError(400, "You cannot remove your own admin role");
    user.role = role;
  }
  if (isActive !== undefined) {
    if (isSelf && !isActive) throw httpError(400, "You cannot deactivate your own account");
    user.isActive = !!isActive;
  }

  await user.save();
  res.json({ success: true, user: user.toSafeObject() });
});

// @route DELETE /api/admin/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "User not found");
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (String(user._id) === String(req.user._id)) throw httpError(400, "You cannot delete your own account");
  const owned = await Reel.countDocuments({ uploadedBy: user._id });
  if (owned > 0) throw httpError(409, `This user owns ${owned} lesson(s). Delete or reassign them first.`);
  await Promise.all([Comment.deleteMany({ user: user._id }), Progress.deleteMany({ user: user._id }), QuizResult.deleteMany({ user: user._id }), require("../models/Bookmark").deleteMany({ user: user._id })]);
  await user.deleteOne();
  res.json({ success: true, message: "User deleted" });
});

// @route GET /api/admin/comments
const getAllComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find()
    .populate("user", "name email")
    .populate("reel", "title")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ success: true, comments });
});

module.exports = { approveClean, listAllReels, moderateReel, getAnalytics, getUsers, updateUser, deleteUser, getAllComments, bulkReelAction, getReelAnalytics };
