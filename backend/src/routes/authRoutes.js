const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { signup, login, getMe, updateMe, changePassword } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// Slow down credential stuffing / brute force (per IP).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 30,
  message: { success: false, message: "Too many attempts, please try again in a few minutes" },
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);
router.put("/password", protect, changePassword);

module.exports = router;
