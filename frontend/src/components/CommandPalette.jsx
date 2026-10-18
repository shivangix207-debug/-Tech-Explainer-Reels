import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Film, Compass, LayoutDashboard, User } from "lucide-react";
import { reelsApi } from "../services/endpoints";

const STATIC_ITEMS = [
  { label: "Watch Feed", to: "/watch", icon: Film },
  { label: "Explore Reels", to: "/reels", icon: Compass },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", to: "/profile", icon: User },
];

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const search = useCallback((q) => {
    if (!q.trim()) return setResults([]);
    reelsApi.list({ search: q, limit: 6 }).then(({ data }) => setResults(data.reels)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  const go = (to) => {
    setOpen(false);
    setQuery("");
    navigate(to);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setOpen(false)} />
      <div className="relative card-elevated w-full max-w-lg overflow-hidden animate-scale-in">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border dark:border-surface-border-dark">
          <Search className="h-4 w-4 text-ink-light/40 dark:text-ink-dark/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reels or jump to a page..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!query && (
            <div className="space-y-0.5">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-light/40 dark:text-ink-dark/40">Quick links</p>
              {STATIC_ITEMS.map((item) => (
                <button
                  key={item.to}
                  onClick={() => go(item.to)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-brand-50 dark:hover:bg-brand-900/20 text-left"
                >
                  <item.icon className="h-4 w-4 text-brand-500" /> {item.label}
                </button>
              ))}
            </div>
          )}

          {query && results.length === 0 && (
            <p className="px-3 py-6 text-sm text-center text-ink-light/50 dark:text-ink-dark/50">No reels found for "{query}"</p>
          )}

          {results.map((r) => (
            <button
              key={r._id}
              onClick={() => go(`/reels/${r._id}`)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-brand-50 dark:hover:bg-brand-900/20 text-left"
            >
              <Film className="h-4 w-4 text-brand-500 shrink-0" />
              <span className="truncate">{r.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
