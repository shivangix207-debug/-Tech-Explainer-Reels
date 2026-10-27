import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { reelsApi, categoriesApi } from "../services/endpoints";
import ReelCard from "../components/ReelCard";
import { SkeletonReelGrid } from "../components/Skeletons";
import EmptyState from "../components/EmptyState";
import { SlidersHorizontal, Search, LayoutGrid } from "lucide-react";

const sortOptions = [
  { value: "latest", label: "Latest" },
  { value: "trending", label: "Trending This Week" },
  { value: "popular", label: "Most Viewed" },
  { value: "most_liked", label: "Most Liked" },
];

const skillOptions = [
  { value: "", label: "All Levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const Reels = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reels, setReels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [infiniteMode, setInfiniteMode] = useState(true);
  const sentinelRef = useRef(null);

  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "latest";
  const skillLevel = searchParams.get("skillLevel") || "";
  const tag = searchParams.get("tag") || "";
  const page = Number(searchParams.get("page")) || 1;

  useEffect(() => {
    categoriesApi.list().then(({ data }) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    setLoading(true);
    reelsApi
      .list({ search, category, sort, skillLevel, tag, page: 1, limit: 12 })
      .then(({ data }) => {
        setReels(data.reels);
        setPagination(data.pagination);
      })
      .finally(() => setLoading(false));
  }, [search, category, sort, skillLevel, tag]);

  // Paged mode: fetch the requested page directly when the user clicks a page number
  useEffect(() => {
    if (infiniteMode || page === 1) return;
    setLoading(true);
    reelsApi.list({ search, category, sort, skillLevel, tag, page, limit: 12 }).then(({ data }) => {
      setReels(data.reels);
      setPagination(data.pagination);
      setLoading(false);
    });
  }, [page, infiniteMode]);

  const loadMore = useCallback(() => {
    if (loadingMore || pagination.page >= pagination.pages) return;
    setLoadingMore(true);
    const nextPage = pagination.page + 1;
    reelsApi.list({ search, category, sort, skillLevel, tag, page: nextPage, limit: 12 }).then(({ data }) => {
      setReels((r) => [...r, ...data.reels]);
      setPagination(data.pagination);
      setLoadingMore(false);
    });
  }, [loadingMore, pagination, search, category, sort, skillLevel, tag]);

  useEffect(() => {
    if (!infiniteMode) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "300px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [infiniteMode, loadMore]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-display font-bold">
          {search ? `Results for "${search}"` : tag ? `Tag: #${tag}` : "Explore Reels"}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="h-4 w-4 text-ink-light/45" />
          <select value={category} onChange={(e) => updateParam("category", e.target.value)} className="input py-2 w-auto">
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          <select value={skillLevel} onChange={(e) => updateParam("skillLevel", e.target.value)} className="input py-2 w-auto">
            {skillOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => updateParam("sort", e.target.value)} className="input py-2 w-auto">
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setInfiniteMode((m) => !m)}
            className="btn-ghost border border-surface-border dark:border-surface-border-dark"
            title="Toggle infinite scroll / pagination"
          >
            <LayoutGrid className="h-4 w-4" /> {infiniteMode ? "Infinite" : "Paged"}
          </button>
        </div>
      </div>

      {tag && (
        <button onClick={() => updateParam("tag", "")} className="badge-accent mb-4">Clear tag filter: #{tag} &times;</button>
      )}

      {loading ? (
        <SkeletonReelGrid />
      ) : reels.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No reels found"
          description="Try a different search term, category, or filter combination."
          actionLabel="Clear filters"
          actionTo="/reels"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {reels.map((r) => <ReelCard key={r._id} reel={r} />)}
          </div>

          {infiniteMode ? (
            <div ref={sentinelRef} className="py-8 flex justify-center">
              {loadingMore && <div className="h-6 w-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />}
              {!loadingMore && pagination.page >= pagination.pages && reels.length > 0 && (
                <p className="text-sm text-ink-light/40">You've reached the end.</p>
              )}
            </div>
          ) : (
            pagination.pages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => updateParam("page", p)}
                    className={`h-9 w-9 rounded-lg text-sm font-medium ${
                      p === page ? "bg-brand-600 text-white" : "bg-brand-50 dark:bg-surface-card-dark hover:bg-surface-border dark:hover:bg-surface-card-dark"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default Reels;
