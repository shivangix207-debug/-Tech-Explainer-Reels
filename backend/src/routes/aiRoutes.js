const express = require("express");
const router = express.Router();
const { chat, notes, quiz, submitQuiz, captions } = require("../controllers/aiController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.post("/chat/:reelId", chat);
router.post("/notes/:reelId", notes);
router.post("/quiz/:reelId", quiz);
router.post("/quiz/:reelId/submit", submitQuiz);
router.post("/captions/:reelId", authorize("creator", "admin"), captions);

module.exports = router;
