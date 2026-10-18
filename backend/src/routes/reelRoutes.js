const express = require("express");
const router = express.Router();
const {
  getReels, getMyReels, getReelById, createReel, updateReel, deleteReel, toggleLike, updateProgress, recordView, reportReel,
} = require("../controllers/reelController");
const { protect, optionalAuth, authorize } = require("../middleware/auth");

router.get("/", optionalAuth, getReels);
router.get("/mine", protect, authorize("creator", "admin"), getMyReels); // must stay above "/:id"
router.get("/:id", optionalAuth, getReelById);

// Creators manage their own lessons; ownership is enforced inside the controller. Admins can manage any.
router.post("/", protect, authorize("creator", "admin"), createReel);
router.put("/:id", protect, authorize("creator", "admin"), updateReel);
router.delete("/:id", protect, authorize("creator", "admin"), deleteReel);

router.post("/:id/view", optionalAuth, recordView);
router.post("/:id/report", protect, reportReel);
router.put("/:id/like", protect, toggleLike);
router.put("/:id/progress", protect, updateProgress);

module.exports = router;
