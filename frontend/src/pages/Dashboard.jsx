import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Target, Trophy, Bookmark, PlayCircle, Flame, Zap, Award, ChevronRight } from "lucide-react";
import { dashboardApi } from "../services/endpoints";
import { BADGE_LABELS } from "../utils/badges";
import ReelCard from "../components/ReelCard";
import EmptyState from "../components/EmptyState";
import { SkeletonStatGrid, SkeletonReelGrid } from "../components/Skeletons";

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="card p-5 flex items-center gap-4 stagger-item">
    <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
      <Icon className="h-5 w-5" style={{ color }} />
    </div>
    <div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-ink-light/60 dark:text-ink-dark/50">{label}</p>
    </div>
  </div>
);

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get().then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <SkeletonStatGrid />
        <SkeletonReelGrid count={5} />
      </div>
    );
  }
  if (!data) return null;

  const { stats, gamification, recentlyWatched, recommended, quizHistory } = data;
  const xpIntoLevel = gamification.xp % 100;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-display font-bold">Your Learning Dashboard</h1>
        <Link to="/leaderboard" className="text-sm font-medium text-brand-600 flex items-center gap-1 hover:underline">
          View Leaderboard <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mb-6">Track your progress and pick up where you left off.</p>

      {/* Gamification banner */}
      <div className="card-elevated p-5 mb-8 flex flex-wrap items-center gap-6 bg-gradient-to-br from-accent-500/5 to-gold-400/5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-accent-500/15 flex items-center justify-center">
            <Flame className="h-6 w-6 text-accent-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{gamification.streak?.current || 0}-day streak</p>
            <p className="text-xs text-ink-light/50">Longest: {gamification.streak?.longest || 0} days</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-brand-500/15 flex items-center justify-center">
            <Zap className="h-6 w-6 text-brand-600" />
          </div>
          <div>
            <p className="text-xl font-bold">Level {gamification.level}</p>
            <div className="h-1.5 w-32 rounded-full bg-surface-border dark:bg-surface-border-dark mt-1 overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${xpIntoLevel}%` }} />
            </div>
            <p className="text-xs text-ink-light/50 mt-0.5">{gamification.xp} XP total</p>
          </div>
        </div>

        {gamification.badges?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {gamification.badges.slice(-4).map((b) => (
              <span key={b.key} className="badge-gold gap-1">
                <Award className="h-3 w-3" /> {BADGE_LABELS[b.key] || b.key}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard icon={PlayCircle} label="Reels Watched" value={stats.reelsWatched} color="#7C3AED" />
        <StatCard icon={Target} label="Progress" value={`${stats.progressPercentage}%`} color="#22A559" />
        <StatCard icon={Trophy} label="Avg Quiz Score" value={`${stats.averageQuizScore}%`} color="#F4B740" />
        <StatCard icon={Bookmark} label="Bookmarks" value={stats.bookmarksCount} color="#06B6D4" />
      </div>

      {recentlyWatched?.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-display font-bold mb-4">Continue Learning</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {recentlyWatched.filter((p) => p.reel).map((p) => <ReelCard key={p._id} reel={p.reel} />)}
          </div>
        </section>
      )}

      {recommended?.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-display font-bold mb-4">Recommended For You</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {recommended.map((r) => <ReelCard key={r._id} reel={r} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5" /> Quiz History</h2>
        {quizHistory?.length === 0 ? (
          <EmptyState icon={BookOpen} title="No quizzes taken yet" description="Watch a reel and try the AI-generated quiz to start tracking your scores." actionLabel="Explore reels" actionTo="/reels" />
        ) : (
          <div className="card divide-y divide-surface-border dark:divide-surface-border-dark">
            {quizHistory.map((q) => (
              <Link key={q._id} to={`/reels/${q.reel?._id}`} className="flex items-center justify-between px-5 py-3 hover:bg-brand-50 dark:hover:bg-surface-card-dark">
                <div>
                  <p className="font-medium text-sm">{q.reel?.title || "Deleted reel"}</p>
                  <p className="text-xs text-ink-light/45">{new Date(q.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`font-bold text-sm ${q.percentage >= 70 ? "text-success" : q.percentage >= 40 ? "text-warning" : "text-error"}`}>
                  {q.percentage}%
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
