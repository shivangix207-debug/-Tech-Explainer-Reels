import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, PlayCircle, ArrowRight, Film, Bot, HelpCircle, Flame } from "lucide-react";
import { reelsApi, categoriesApi, dashboardApi } from "../services/endpoints";
import { useAuth } from "../context/AuthContext";
import ReelCard from "../components/ReelCard";
import { SkeletonReelGrid } from "../components/Skeletons";

const STEPS = [
  { icon: Film, title: "Watch a 60-second reel", text: "One concept per lesson, narrated and animated." },
  { icon: Bot, title: "Ask the AI tutor", text: "Stuck? Ask questions grounded in that lesson's transcript." },
  { icon: HelpCircle, title: "Test yourself", text: "Take the quiz, track your progress and build a streak." },
];

const Section = ({ title, icon: Icon, to, children }) => (
  <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-display font-bold flex items-center gap-2">{Icon && <Icon className="h-5 w-5 text-brand-500" />}{title}</h2>
      {to && <Link to={to} className="text-sm font-medium text-brand-500 flex items-center gap-1 hover:underline">See all <ArrowRight className="h-4 w-4" /></Link>}
    </div>
    {children}
  </section>
);
const Grid = ({ reels }) => <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{reels.map((r) => <ReelCard key={r._id} reel={r} />)}</div>;

// Every lesson appears at most ONCE on this page: each section only shows lessons the sections above didn't.
const Home = () => {
  const { user } = useAuth();
  const [all, setAll] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, c] = await Promise.all([reelsApi.list({ sort: "latest", limit: 40 }), categoriesApi.list()]);
        if (!alive) return;
        setAll(r.data.reels); setCategories(c.data.categories.filter((x) => (x.reelCount ?? 1) > 0));
        if (user) dashboardApi.get().then(({ data }) => alive && setDash(data)).catch(() => {});
      } finally { alive && setLoading(false); }
    })();
    return () => { alive = false; };
  }, [user]);

  const { cont, recommended, rest } = useMemo(() => {
    const byId = new Map(all.map((r) => [r._id, r]));
    const used = new Set();
    const take = (list) => list.filter((r) => r && !used.has(r._id)).map((r) => { used.add(r._id); return r; });
    const cont = take((dash?.recentlyWatched || []).filter((p) => !p.completed).map((p) => byId.get(p.reel?._id)));
    const recommended = take((dash?.becauseYouWatched?.reels || []).map((r) => byId.get(r._id)));
    const rest = take(all);
    return { cont, recommended, rest };
  }, [all, dash]);

  if (loading) return <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10"><SkeletonReelGrid /></div>;

  return (
    <div>
      {!user ? (
        <section className="relative overflow-hidden gradient-hero">
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 sm:py-24 text-center">
            <span className="badge bg-brand-500/15 text-brand-400 mb-4 gap-1"><Sparkles className="h-3.5 w-3.5" /> AI-powered learning</span>
            <h1 className="text-4xl sm:text-6xl font-display font-extrabold tracking-tight leading-tight">Learn tech concepts in <span className="text-brand-500">60 seconds.</span></h1>
            <p className="mt-4 text-base sm:text-lg text-ink-light/75 dark:text-ink-dark/60 max-w-2xl mx-auto">Short narrated explainers on web development, databases, security, cloud and AI, each with an AI tutor, notes and a quiz.</p>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <Link to="/watch" className="btn-primary text-base px-6 py-3"><Film className="h-5 w-5" /> Start watching</Link>
              <Link to="/signup" className="btn-secondary text-base px-6 py-3">Create free account</Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold">Welcome back, {user.name?.split(" ")[0]}</h1>
            <p className="text-sm text-ink-light/60 dark:text-ink-dark/50">{user.streak > 0 ? <span className="inline-flex items-center gap-1"><Flame className="h-4 w-4 text-accent-500" />{user.streak}-day streak - </span> : null}Pick up where you left off.</p>
          </div>
          <Link to="/watch" className="btn-primary"><PlayCircle className="h-4 w-4" /> Open the reel feed</Link>
        </section>
      )}

      {!user && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid sm:grid-cols-3 gap-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="card p-5">
              <div className="h-10 w-10 rounded-xl bg-brand-500/15 flex items-center justify-center mb-3"><Icon className="h-5 w-5 text-brand-500" /></div>
              <p className="font-semibold">{i + 1}. {title}</p>
              <p className="text-sm text-ink-light/65 dark:text-ink-dark/55 mt-1">{text}</p>
            </div>
          ))}
        </section>
      )}

      {cont.length > 0 && <Section title="Continue learning" icon={PlayCircle}><Grid reels={cont} /></Section>}
      {recommended.length > 0 && <Section title={`Because you watched "${dash.becauseYouWatched.basedOn}"`} icon={Sparkles}><Grid reels={recommended} /></Section>}

      {categories.length > 0 && (
        <Section title="Browse by topic">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {categories.map((c) => (
              <Link key={c._id} to={`/reels?category=${c._id}`} className="shrink-0 card px-4 py-3 min-w-[150px] hover:border-brand-500/60 transition-colors">
                <span className="block h-1.5 w-8 rounded-full mb-2" style={{ backgroundColor: c.color }} />
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-xs text-ink-light/60 dark:text-ink-dark/50">{c.reelCount} {c.reelCount === 1 ? "lesson" : "lessons"}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {rest.length > 0 && <Section title={cont.length || recommended.length ? "More lessons" : "All lessons"} to="/reels"><Grid reels={rest} /></Section>}
      {all.length === 0 && <p className="text-center py-16 text-ink-light/60 dark:text-ink-dark/50">No lessons yet - run <code>npm run seed</code>.</p>}
    </div>
  );
};

export default Home;
