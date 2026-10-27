import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Flame, Award, Medal } from "lucide-react";
import { socialApi } from "../services/endpoints";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const rankColor = (rank) => (rank === 1 ? "text-gold-400" : rank === 2 ? "text-ink-light/40" : rank === 3 ? "text-accent-500" : "text-ink-light/30");

const Leaderboard = () => {
  const [board, setBoard] = useState(null);

  useEffect(() => {
    socialApi.leaderboard().then(({ data }) => setBoard(data.leaderboard));
  }, []);

  if (!board) return <Spinner full />;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-display font-bold flex items-center gap-2 mb-1"><Trophy className="h-6 w-6 text-gold-400" /> Leaderboard</h1>
      <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mb-6">Top learners by XP. Only opted-in users appear here.</p>

      {board.length === 0 ? (
        <EmptyState icon={Trophy} title="Nobody here yet" description="Be the first to opt in from your profile and start earning XP." />
      ) : (
        <div className="card divide-y divide-surface-border dark:divide-surface-border-dark">
          {board.map((entry) => (
            <Link key={entry.id} to={`/u/${entry.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-brand-50 dark:hover:bg-surface-card-dark">
              <span className={`w-6 text-center font-bold ${rankColor(entry.rank)}`}>
                {entry.rank <= 3 ? <Medal className="h-5 w-5 mx-auto" /> : entry.rank}
              </span>
              <div className="h-9 w-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold">
                {entry.displayName?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{entry.displayName}</p>
                <div className="flex items-center gap-3 text-xs text-ink-light/50">
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3" /> {entry.streak}d</span>
                  <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {entry.badgeCount}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{entry.xp} XP</p>
                <p className="text-xs text-ink-light/45">Lvl {entry.level}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
