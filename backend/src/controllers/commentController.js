const Comment = require("../models/Comment");
const Reel = require("../models/Reel");
const { asyncHandler } = require("../middleware/errorHandler");
const { canViewReel, isPubliclyVisible } = require("../middleware/auth");
const { isValidId, httpError } = require("../utils/helpers");

const cleanText = (t) => String(t ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

// @route GET /api/reels/:reelId/comments
const getComments = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.reelId)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.reelId).select("status scheduledAt isPublished uploadedBy");
  if (!reel || !canViewReel(reel, req.user)) throw httpError(404, "Reel not found");
  const comments = await Comment.find({ reel: req.params.reelId })
    .populate("user", "name avatar")
    .sort({ createdAt: -1 });
  res.json({ success: true, comments });
});

// @route POST /api/reels/:reelId/comments
const addComment = asyncHandler(async (req, res) => {
  const text = cleanText(req.body.text);
  if (!text) return res.status(400).json({ success: false, message: "Comment text is required" });
  if (text.length > 500) return res.status(400).json({ success: false, message: "Comments are limited to 500 characters" });

  if (!isValidId(req.params.reelId)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.reelId).select("status scheduledAt isPublished uploadedBy");
  if (!reel || !isPubliclyVisible(reel)) throw httpError(404, "Reel not found"); // comments only on published lessons

  const comment = await Comment.create({ reel: req.params.reelId, user: req.user._id, text });
  await comment.populate("user", "name avatar");

  res.status(201).json({ success: true, comment });
});

// @route PUT /api/comments/:id
const updateComment = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Comment not found");
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

  const isOwner = comment.user.toString() === req.user._id.toString();
  if (!isOwner) {
    return res.status(403).json({ success: false, message: "You can only edit your own comments" });
  }

  const text = cleanText(req.body.text);
  if (!text || text.length > 500) return res.status(400).json({ success: false, message: "Comment must be 1-500 characters" });
  comment.text = text;
  comment.edited = true;
  await comment.save();

  res.json({ success: true, comment });
});

// @route PUT /api/comments/:id/react (toggle a heart/like reaction)
const toggleReaction = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Comment not found");
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

  const userId = req.user._id.toString();
  const already = comment.reactions.some((id) => id.toString() === userId);
  comment.reactions = already
    ? comment.reactions.filter((id) => id.toString() !== userId)
    : [...comment.reactions, req.user._id];

  await comment.save();
  res.json({ success: true, reacted: !already, reactionCount: comment.reactions.length });
});

// @route DELETE /api/comments/:id
const deleteComment = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw httpError(404, "Comment not found");
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

  const isOwner = comment.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: "Not authorized to delete this comment" });
  }

  await comment.deleteOne();
  res.json({ success: true, message: "Comment deleted" });
});

module.exports = { getComments, addComment, updateComment, deleteComment, toggleReaction };
