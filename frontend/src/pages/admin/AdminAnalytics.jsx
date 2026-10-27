import { useEffect, useState } from "react";
import { Users, Film, FolderKanban, MessageSquare, Trophy, TrendingUp } from "lucide-react";
import { adminApi } from "../../services/endpoints";
import { SkeletonStatGrid } from "../../components/Skeletons";
import SignupChart from "../../components/SignupChart";

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

const RANGE_OPTIONS = [7, 14, 30, 90];

const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.analytics(days).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [days]);

  if (loading && !data) {
    return (
      <div>
        <h1 className="text-2xl font-display font-bold mb-6">Analytics Overview</h1>
        <SkeletonStatGrid count={5} />
      </div>
    );
  }
  if (!data) return null;

  const { totals, mostViewedReels, mostAttemptedQuizzes, recentUsers, signupTrend } = data;

  return (
    <div>
      <h1 className="text-2xl font-display font-bold mb-6">Analytics Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard icon={Users} label="Total Users" value={totals.totalUsers} color="#7C3AED" />
        <StatCard icon={Film} label="Total Reels" value={totals.totalReels} color="#06B6D4" />
        <StatCard icon={FolderKanban} label="Pending review" value={totals.pendingReview ?? 0} color="#F4B740" />
        <StatCard icon={MessageSquare} label="Comments" value={totals.totalComments} color="#F4B740" />
        <StatCard icon={Trophy} label="Quizzes Taken" value={totals.totalQuizzes} color="#22A559" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Film} label="Auto-approved lessons" value={totals.autoApproved ?? 0} color="#22A559" />
        <StatCard icon={FolderKanban} label="Flagged for review" value={totals.flagged ?? 0} color="#EF4444" />
        <StatCard icon={Trophy} label="Awaiting spot-check" value={totals.spotChecks ?? 0} color="#06B6D4" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Most Viewed Reels</h3>
          <div className="space-y-3">
            {mostViewedReels.map((r) => (
              <div key={r._id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-4">{r.title}</span>
                <span className="font-semibold text-brand-600 shrink-0">{r.views} views</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4" /> Most Attempted Quizzes</h3>
          <div className="space-y-3">
            {mostAttemptedQuizzes.map((q, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate pr-4">{q.reel?.title}</span>
                <span className="font-semibold shrink-0">{q.attempts} attempts &middot; {q.avgScore}% avg</span>
              </div>
            ))}
            {mostAttemptedQuizzes.length === 0 && <p className="text-sm text-ink-light/45">No quiz attempts yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Signups</h3>
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium ${days === d ? "bg-brand-600 text-white" : "bg-black/5 dark:bg-white/10 text-ink-light/60 dark:text-ink-dark/50"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <SignupChart data={signupTrend} />
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Recent Signups</h3>
          <div className="space-y-3">
            {recentUsers.map((u) => (
              <div key={u._id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-ink-light/45">{u.email}</p>
                </div>
                <span className="text-xs text-ink-light/45">{new Date(u.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
