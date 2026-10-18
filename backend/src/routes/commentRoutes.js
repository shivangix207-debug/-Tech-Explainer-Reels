const express = require("express");
const router = express.Router({ mergeParams: true });
const { getComments, addComment, updateComment, deleteComment, toggleReaction } = require("../controllers/commentController");
const { protect, optionalAuth } = require("../middleware/auth");

// Mounted at /api/reels/:reelId/comments
router.get("/", optionalAuth, getComments);
router.post("/", protect, addComment);

module.exports = router;

// Standalone router mounted at /api/comments for edit/delete by comment id
const standalone = express.Router();
standalone.put("/:id", protect, updateComment);
standalone.delete("/:id", protect, deleteComment);
standalone.put("/:id/react", protect, toggleReaction);
module.exports.standalone = standalone;
