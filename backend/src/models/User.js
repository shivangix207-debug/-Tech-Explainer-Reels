const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    // "user" is the Student role (kept as "user" so existing accounts keep working)
    role: { type: String, enum: ["user", "creator", "admin"], default: "user" },
    // Admin-granted trust: this creator's clean uploads publish immediately (also earned automatically, see utils/moderation.js)
    trusted: { type: Boolean, default: false },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 200 },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },

    // --- Additive fields (personalization, gamification, social) ---
    skillLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    interests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    onboarded: { type: Boolean, default: false },

    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: { type: String, default: null }, // stored as YYYY-MM-DD for simple day comparisons
    },
    badges: [
      {
        key: { type: String, required: true },
        earnedAt: { type: Date, default: Date.now },
      },
    ],

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    leaderboardOptIn: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    trusted: this.trusted,
    avatar: this.avatar,
    bio: this.bio,
    createdAt: this.createdAt,
    skillLevel: this.skillLevel,
    interests: this.interests,
    onboarded: this.onboarded,
    xp: this.xp,
    level: this.level,
    streak: this.streak,
    badges: this.badges,
    followerCount: this.followers?.length || 0,
    followingCount: this.following?.length || 0,
    leaderboardOptIn: this.leaderboardOptIn,
  };
};

// Public-safe view for another user's profile (no email)
userSchema.methods.toPublicObject = function () {
  return {
    id: this._id,
    name: this.name,
    avatar: this.avatar,
    bio: this.bio,
    role: this.role,
    createdAt: this.createdAt,
    level: this.level,
    xp: this.xp,
    badges: this.badges,
    followerCount: this.followers?.length || 0,
    followingCount: this.following?.length || 0,
  };
};

module.exports = mongoose.model("User", userSchema);
