const User = require("../models/User");
const { asyncHandler } = require("../middleware/errorHandler");

// @route GET /api/social/users/:id
const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || !user.isActive) return res.status(404).json({ success: false, message: "User not found" });

  const isFollowing = req.user ? user.followers.some((id) => id.toString() === req.user._id.toString()) : false;
  res.json({ success: true, user: user.toPublicObject(), isFollowing, isSelf: req.user?._id?.toString() === user._id.toString() });
});

// @route PUT /api/social/users/:id/follow (toggle)
const toggleFollow = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: "You can't follow yourself" });
  }
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ success: false, message: "User not found" });

  const me = req.user;
  const alreadyFollowing = me.following.some((id) => id.toString() === target._id.toString());

  if (alreadyFollowing) {
    me.following = me.following.filter((id) => id.toString() !== target._id.toString());
    target.followers = target.followers.filter((id) => id.toString() !== me._id.toString());
  } else {
    me.following.push(target._id);
    target.followers.push(me._id);
  }

  await Promise.all([me.save(), target.save()]);
  res.json({ success: true, following: !alreadyFollowing, followerCount: target.followers.length });
});

// @route GET /api/social/leaderboard  (weekly XP leaderboard, opt-in only)
// Since we don't store per-week XP separately, we rank opted-in users by
// total XP as a simple, honest approximation, refreshed on every request.
const getLeaderboard = asyncHandler(async (req, res) => {
  const users = await User.find({ role: "user", leaderboardOptIn: true, isActive: true })
    .sort({ xp: -1 })
    .limit(20)
    .select("name avatar xp level streak badges");

  // Privacy: show first name + last initial rather than full name/email
  const board = users.map((u, i) => {
    const parts = (u.name || "").trim().split(" ");
    const displayName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || "Learner";
    return {
      rank: i + 1,
      id: u._id,
      displayName,
      avatar: u.avatar,
      xp: u.xp,
      level: u.level,
      streak: u.streak?.current || 0,
      badgeCount: u.badges?.length || 0,
    };
  });

  res.json({ success: true, leaderboard: board });
});

module.exports = { getPublicProfile, toggleFollow, getLeaderboard };
