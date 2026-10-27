const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const { asyncHandler } = require("../middleware/errorHandler");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

// @route POST /api/auth/signup
const signup = asyncHandler(async (req, res) => {
  const { name, email, password, interests, skillLevel, accountType } = req.body;

  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || !name.trim() || !email.trim() || !password) {
    return res.status(400).json({ success: false, message: "Name, email, and password are required" });
  }
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return res.status(400).json({ success: false, message: "Please provide a valid email" });
  }
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({ success: false, message: "Password must be 8-72 characters" });
  }
  if (skillLevel !== undefined && !["beginner", "intermediate", "advanced"].includes(skillLevel)) {
    return res.status(400).json({ success: false, message: "Invalid skill level" });
  }

  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    return res.status(400).json({ success: false, message: "An account with this email already exists" });
  }

  // SECURITY: the role is decided here, never copied from the request. Only "student" or "creator"
  // can be self-selected; "admin" can only be granted by an existing admin or the createAdmin script.
  const role = accountType === "creator" ? "creator" : "user";
  const cleanInterests = Array.isArray(interests) ? interests.filter((i) => mongoose.isValidObjectId(i)) : [];

  const user = await User.create({
    name: name.trim(),
    email: email.trim(),
    password,
    role,
    interests: cleanInterests,
    skillLevel: skillLevel || "beginner",
    onboarded: cleanInterests.length > 0,
  });
  const token = signToken(user._id);

  res.status(201).json({ success: true, token, user: user.toSafeObject() });
});

// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "This account has been deactivated" });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user._id);
  res.json({ success: true, token, user: user.toSafeObject() });
});

// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

// @route PUT /api/auth/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, bio, avatar, interests, skillLevel, onboarded, leaderboardOptIn } = req.body;
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ success: false, message: "Name cannot be empty" });
    req.user.name = name.trim();
  }
  if (bio !== undefined) req.user.bio = String(bio).slice(0, 200);
  if (avatar !== undefined) req.user.avatar = String(avatar).slice(0, 500);
  if (interests !== undefined) req.user.interests = Array.isArray(interests) ? interests.filter((i) => mongoose.isValidObjectId(i)) : [];
  if (skillLevel !== undefined) {
    if (!["beginner", "intermediate", "advanced"].includes(skillLevel)) return res.status(400).json({ success: false, message: "Invalid skill level" });
    req.user.skillLevel = skillLevel;
  }
  if (onboarded !== undefined) req.user.onboarded = onboarded;
  if (leaderboardOptIn !== undefined) req.user.leaderboardOptIn = leaderboardOptIn;
  await req.user.save();
  res.json({ success: true, user: req.user.toSafeObject() });
});

// @route PUT /api/auth/password  { currentPassword, newPassword }
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 72) {
    return res.status(400).json({ success: false, message: "New password must be 8-72 characters" });
  }
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(401).json({ success: false, message: "Current password is incorrect" });
  }
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: "Password updated" });
});

module.exports = { signup, login, getMe, updateMe, changePassword };
