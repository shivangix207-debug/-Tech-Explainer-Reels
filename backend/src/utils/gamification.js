const Progress = require("../models/Progress");
const QuizResult = require("../models/QuizResult");

const XP_REEL_WATCH = 10;
const XP_QUIZ_ATTEMPT = 10;
const XP_QUIZ_PASS_BONUS = 15; // on top of the attempt XP, for scoring >= 80%

const levelForXp = (xp) => Math.floor(xp / 100) + 1;

const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

const dayBefore = (dateKey) => {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Bumps the user's daily streak based on today's activity. Safe to call
// multiple times a day - only advances the streak once per calendar day.
const registerDailyActivity = (user) => {
  const today = todayKey();
  const streak = user.streak || { current: 0, longest: 0, lastActiveDate: null };

  if (streak.lastActiveDate === today) {
    // already counted today
  } else if (streak.lastActiveDate === dayBefore(today)) {
    streak.current = (streak.current || 0) + 1;
  } else {
    streak.current = 1;
  }
  streak.longest = Math.max(streak.longest || 0, streak.current);
  streak.lastActiveDate = today;
  user.streak = streak;
};

const addXp = (user, amount) => {
  user.xp = (user.xp || 0) + amount;
  user.level = levelForXp(user.xp);
};

const BADGE_DEFS = [
  { key: "quiz-master", label: "Quiz Master", description: "Passed 5+ quizzes with 80% or higher" },
  { key: "quiz-legend", label: "Quiz Legend", description: "Passed 20+ quizzes with 80% or higher" },
  { key: "streak-3", label: "3-Day Streak", description: "Learned 3 days in a row" },
  { key: "streak-7", label: "Week Warrior", description: "Learned 7 days in a row" },
  { key: "streak-30", label: "Monthly Master", description: "Learned 30 days in a row" },
  { key: "explorer-10", label: "Explorer", description: "Watched 10 reels" },
  { key: "explorer-50", label: "Tech Explorer", description: "Watched 50 reels" },
];

const hasBadge = (user, key) => (user.badges || []).some((b) => b.key === key);
const awardBadge = (user, key) => {
  if (!hasBadge(user, key)) {
    user.badges = [...(user.badges || []), { key, earnedAt: new Date() }];
    return true;
  }
  return false;
};

// Re-evaluates badge eligibility for a user. Cheap aggregate queries, called
// after the actions that could plausibly unlock a badge (reel completed,
// quiz submitted) rather than on every page load.
const evaluateBadges = async (user) => {
  const [watchedCount, passedQuizCount] = await Promise.all([
    Progress.countDocuments({ user: user._id, completed: true }),
    QuizResult.countDocuments({ user: user._id, percentage: { $gte: 80 } }),
  ]);

  const newlyAwarded = [];
  const maybeAward = (key) => {
    if (awardBadge(user, key)) newlyAwarded.push(key);
  };

  if (watchedCount >= 10) maybeAward("explorer-10");
  if (watchedCount >= 50) maybeAward("explorer-50");
  if (passedQuizCount >= 5) maybeAward("quiz-master");
  if (passedQuizCount >= 20) maybeAward("quiz-legend");
  if ((user.streak?.current || 0) >= 3) maybeAward("streak-3");
  if ((user.streak?.current || 0) >= 7) maybeAward("streak-7");
  if ((user.streak?.current || 0) >= 30) maybeAward("streak-30");

  return newlyAwarded;
};

module.exports = {
  XP_REEL_WATCH,
  XP_QUIZ_ATTEMPT,
  XP_QUIZ_PASS_BONUS,
  BADGE_DEFS,
  levelForXp,
  registerDailyActivity,
  addXp,
  evaluateBadges,
};
