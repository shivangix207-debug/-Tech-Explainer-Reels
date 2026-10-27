const express = require("express");
const router = express.Router();
const { getPublicProfile, toggleFollow, getLeaderboard } = require("../controllers/socialController");
const { protect, optionalAuth } = require("../middleware/auth");

router.get("/leaderboard", getLeaderboard);
router.get("/users/:id", optionalAuth, getPublicProfile);
router.put("/users/:id/follow", protect, toggleFollow);

module.exports = router;
