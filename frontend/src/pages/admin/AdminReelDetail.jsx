import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Eye, Clock, Target, HelpCircle } from "lucide-react";
import { adminApi } from "../../services/endpoints";
import Spinner from "../../components/Spinner";

const StatBlock = ({ icon: Icon, label, value }) => (
  <div className="card p-5">
    <Icon className="h-5 w-5 text-brand-600 mb-2" />
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-ink-light/60 dark:text-ink-dark/50">{label}</p>
  </div>
);

const AdminReelDetail = () => {
  const { id } = useParams();
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    adminApi.reelAnalytics(id).then(({ data }) => setAnalytics(data.analytics));
  }, [id]);

  if (!analytics) return <Spinner full />;

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div>
      <Link to="/admin/reels" className="text-sm text-ink-light/50 hover:text-brand-600 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to reels
      </Link>
      <h1 className="text-2xl font-display font-bold mb-1">{analytics.title}</h1>
      <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mb-6">Duration: {fmt(analytics.duration || 0)}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatBlock icon={Eye} label="Viewers" value={analytics.viewers} />
        <StatBlock icon={Target} label="Completion Rate" value={`${analytics.completionRate}%`} />
        <StatBlock icon={Clock} label="Avg Watch Time" value={fmt(analytics.avgWatchSeconds)} />
        <StatBlock icon={HelpCircle} label="Quiz Pass Rate" value={`${analytics.quizPassRate}%`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-3">Watch time</h3>
          <p className="text-sm text-ink-light/60 dark:text-ink-dark/50">
            Total watch time across all viewers: <span className="font-semibold text-ink-light dark:text-ink-dark">{fmt(analytics.totalWatchSeconds)}</span>
          </p>
          <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mt-1">
            Approximate drop-off point: <span className="font-semibold text-ink-light dark:text-ink-dark">{fmt(analytics.avgDropOffSeconds)}</span> into the reel
          </p>
          <div className="h-2 rounded-full bg-surface-border dark:bg-surface-border-dark mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-accent-500"
              style={{ width: `${analytics.duration ? Math.min(100, (analytics.avgDropOffSeconds / analytics.duration) * 100) : 0}%` }}
            />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-3">Quiz performance</h3>
          <p className="text-sm text-ink-light/60 dark:text-ink-dark/50">
            {analytics.quizAttempts} attempt{analytics.quizAttempts === 1 ? "" : "s"}, {analytics.quizPassRate}% passed (&ge;80%)
          </p>
          <div className="h-2 rounded-full bg-surface-border dark:bg-surface-border-dark mt-3 overflow-hidden">
            <div className="h-full bg-success" style={{ width: `${analytics.quizPassRate}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReelDetail;
