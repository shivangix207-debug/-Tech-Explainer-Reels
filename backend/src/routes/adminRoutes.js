const express = require("express");
const router = express.Router();
const {
  approveClean, listAllReels, moderateReel, getAnalytics, getUsers, updateUser, deleteUser, getAllComments, bulkReelAction, getReelAnalytics,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin"));

router.get("/analytics", getAnalytics);
router.get("/users", getUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.get("/comments", getAllComments);
router.get("/reels", listAllReels);
router.post("/reels/approve-clean", approveClean);
router.put("/reels/bulk", bulkReelAction); // keep above /reels/:id/*
router.put("/reels/:id/status", moderateReel);
router.get("/reels/:id/analytics", getReelAnalytics);

module.exports = router;
