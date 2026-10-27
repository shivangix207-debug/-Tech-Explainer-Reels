import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, History, Trophy } from "lucide-react";
import { bookmarksApi, dashboardApi } from "../services/endpoints";
import ReelCard from "../components/ReelCard";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";

const TABS = [["saved", "Saved", Bookmark], ["history", "History", History], ["quizzes", "Quiz results", Trophy]];
const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Saved lessons, full watch history and quiz attempts - all read from the database.
const Library = () => {
  const [tab, setTab] = useState("saved");
  const [saved, setSaved] = useState([]);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([bookmarksApi.list(), dashboardApi.get()])
      .then(([b, d]) => { setSaved(b.data.bookmarks); setDash(d.data); })
      .catch(() => setError("Couldn't load your library. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner full />;
  const history = dash?.history || [];
  const quizzes = dash?.quizHistory || [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold mb-4">My library</h1>
      <div className="flex gap-1 mb-6 card p-1 w-fit">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold ${tab === id ? "bg-brand-600 text-white" : "text-ink-light/60 dark:text-ink-dark/60 hover:bg-brand-500/10"}`}><Icon className="h-4 w-4" /> {label}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-error text-sm mb-4">{error}</p>}

      {tab === "saved" && (saved.length === 0
        ? <EmptyState icon={Bookmark} title="Nothing saved yet" description="Tap Save on any lesson to keep it here." actionLabel="Explore lessons" actionTo="/reels" />
        : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{saved.map((b) => <ReelCard key={b._id} reel={b.reel} />)}</div>)}

      {tab === "history" && (history.length === 0
        ? <EmptyState icon={History} title="No watch history" description="Lessons you watch will show up here with your progress." actionLabel="Start learning" actionTo="/reels" />
        : <div className="card divide-y divide-surface-border dark:divide-surface-border-dark">
            {history.map((p) => {
              const pct = p.reel.duration ? Math.min(100, Math.round((p.watchedSeconds / p.reel.duration) * 100)) : 0;
              return (
                <Link key={p._id} to={`/reels/${p.reel._id}`} className="flex items-center gap-4 p-4 hover:bg-brand-500/5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.reel.title}</p>
                    <div className="h-1.5 mt-2 rounded-full bg-surface-border dark:bg-surface-border-dark overflow-hidden max-w-xs"><div className="h-full bg-brand-500" style={{ width: `${p.completed ? 100 : pct}%` }} /></div>
                  </div>
                  <div className="text-right text-xs text-ink-light/60 dark:text-ink-dark/50 shrink-0">
                    <p className={p.completed ? "text-success font-semibold" : ""}>{p.completed ? "Completed" : `${pct}% watched`}</p>
                    <p>{fmt(p.lastWatchedAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>)}

      {tab === "quizzes" && (quizzes.length === 0
        ? <EmptyState icon={Trophy} title="No quiz attempts yet" description="Take a quiz on any lesson to see your scores here." actionLabel="Find a lesson" actionTo="/reels" />
        : <div className="card divide-y divide-surface-border dark:divide-surface-border-dark">
            {quizzes.map((q) => (
              <div key={q._id} className="flex items-center justify-between p-4 text-sm">
                <div className="min-w-0"><p className="font-medium truncate">{q.reel?.title || "Deleted lesson"}</p><p className="text-xs text-ink-light/60 dark:text-ink-dark/50">{fmt(q.createdAt)} · {q.source === "lesson" ? "Lesson quiz" : "AI quiz"}</p></div>
                <span className={`font-display font-bold ${q.percentage >= 80 ? "text-success" : q.percentage >= 50 ? "text-gold-500" : "text-error"}`}>{q.score}/{q.totalQuestions} · {q.percentage}%</span>
              </div>
            ))}
          </div>)}
    </div>
  );
};

export default Library;
