const Bookmark = require("../models/Bookmark");
const Reel = require("../models/Reel");
const { asyncHandler } = require("../middleware/errorHandler");
const { canViewReel } = require("../middleware/auth");
const { isValidId, httpError } = require("../utils/helpers");

// @route GET /api/bookmarks
const getMyBookmarks = asyncHandler(async (req, res) => {
  const bookmarks = (await Bookmark.find({ user: req.user._id })
    .populate({
      path: "reel",
      populate: { path: "category", select: "name slug color" },
    })
    .sort({ createdAt: -1 })).filter((b) => b.reel); // drop bookmarks whose lesson was deleted

  res.json({ success: true, bookmarks });
});

// @route POST /api/bookmarks/:reelId
const addBookmark = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.reelId)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.reelId).select("status scheduledAt isPublished uploadedBy");
  if (!reel || !canViewReel(reel, req.user)) throw httpError(404, "Reel not found");

  // upsert + unique index (user, reel) means concurrent requests can never create duplicates
  const r = await Bookmark.updateOne({ user: req.user._id, reel: reel._id }, { $setOnInsert: { user: req.user._id, reel: reel._id } }, { upsert: true });
  res.status(r.upsertedCount ? 201 : 200).json({ success: true, bookmarked: true });
});

// @route DELETE /api/bookmarks/:reelId
const removeBookmark = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.reelId)) throw httpError(404, "Reel not found");
  await Bookmark.deleteOne({ user: req.user._id, reel: req.params.reelId });
  res.json({ success: true, bookmarked: false });
});

module.exports = { getMyBookmarks, addBookmark, removeBookmark };
