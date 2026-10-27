const Progress = require("../models/Progress");
const QuizResult = require("../models/QuizResult");
const Bookmark = require("../models/Bookmark");
const Reel = require("../models/Reel");
const { asyncHandler } = require("../middleware/errorHandler");

// @route GET /api/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [progressList, quizResults, bookmarkCount, totalReels] = await Promise.all([
    Progress.find({ user: userId })
      .populate({ path: "reel", populate: { path: "category", select: "name color" } })
      .sort({ lastWatchedAt: -1 }),
    QuizResult.find({ user: userId }).populate("reel", "title").sort({ createdAt: -1 }).limit(200),
    Bookmark.countDocuments({ user: userId }),
    Reel.countDocuments({ isPublished: true }),
  ]);

  const watchedCount = progressList.filter((p) => p.completed).length;
  const recentlyWatched = progressList.filter((p) => p.reel).slice(0, 5);

  const avgScore = quizResults.length
    ? Math.round(quizResults.reduce((sum, q) => sum + q.percentage, 0) / quizResults.length)
    : 0;

  const watchedCategoryIds = new Set(
    progressList.filter((p) => p.reel?.category).map((p) => p.reel.category._id?.toString() || p.reel.category.toString())
  );

  // Simple recommendation: unwatched reels from categories the user has engaged with,
  // falling back to trending reels.
  const watchedReelIds = progressList.map((p) => p.reel?._id).filter(Boolean);
  let recommended = [];
  if (watchedCategoryIds.size > 0) {
    recommended = await Reel.find({
      category: { $in: Array.from(watchedCategoryIds) },
      _id: { $nin: watchedReelIds },
      isPublished: true,
    })
      .populate("category", "name color")
      .sort({ views: -1 })
      .limit(6);
  }
  if (recommended.length === 0) {
    recommended = await Reel.find({ _id: { $nin: watchedReelIds }, isPublished: true })
      .populate("category", "name color")
      .sort({ views: -1 })
      .limit(6);
  }

  const progressPercentage = totalReels ? Math.round((watchedCount / totalReels) * 100) : 0;

  // "Because you watched X" - pick the most recently watched reel's category
  // and suggest more from that same category, distinct from the general
  // `recommended` list so the UI can label it specifically.
  let becauseYouWatched = null;
  const lastWatched = recentlyWatched[0]?.reel;
  if (lastWatched?.category) {
    const catId = lastWatched.category._id || lastWatched.category;
    const more = await Reel.find({
      category: catId,
      _id: { $nin: [...watchedReelIds, lastWatched._id] },
      isPublished: true,
    })
      .populate("category", "name color")
      .sort({ views: -1 })
      .limit(6);
    if (more.length > 0) {
      becauseYouWatched = { basedOn: lastWatched.title, reels: more };
    }
  }

  res.json({
    success: true,
    stats: {
      reelsWatched: watchedCount,
      totalReels,
      progressPercentage,
      quizzesTaken: quizResults.length,
      averageQuizScore: avgScore,
      bookmarksCount: bookmarkCount,
    },
    gamification: {
      xp: req.user.xp,
      level: req.user.level,
      streak: req.user.streak,
      badges: req.user.badges,
    },
    recentlyWatched,
    history: progressList.filter((p) => p.reel).slice(0, 50),
    recommended,
    becauseYouWatched,
    quizHistory: quizResults.slice(0, 30),
  });
});

module.exports = { getDashboard };
