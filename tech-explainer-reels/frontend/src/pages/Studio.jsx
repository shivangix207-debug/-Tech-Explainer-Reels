import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, Heart, Film } from "lucide-react";
import { reelsApi, categoriesApi } from "../services/endpoints";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import LessonFormModal from "../components/LessonFormModal";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { SkeletonRow } from "../components/Skeletons";
import { useAuth } from "../context/AuthContext";

// Creator Studio: upload and manage your own lessons. (Admins can use it too; they see only their own here.)
const Studio = () => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [reels, setReels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [trust, setTrust] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, editing: null });

  const load = () => {
    setLoading(true);
    Promise.all([reelsApi.mine(), categoriesApi.list()])
      .then(([r, c]) => { setReels(r.data.reels); setTrust(r.data.trust); setCategories(c.data.categories); })
      .catch(() => toast("Couldn't load your lessons", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (r) => {
    const ok = await confirm({ title: `Delete "${r.title}"?`, message: "The video file, comments and progress for this lesson will be removed. This cannot be undone.", confirmLabel: "Delete" });
    if (!ok) return;
    try { await reelsApi.remove(r._id); setReels((x) => x.filter((i) => i._id !== r._id)); toast("Lesson deleted", "success"); }
    catch (err) { toast(err.response?.data?.message || "Couldn't delete the lesson", "error"); }
  };

  const count = (s) => reels.filter((r) => r.status === s).length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Creator Studio</h1>
          <p className="text-sm text-ink-light/60 dark:text-ink-dark/50">Upload lessons and track their review status{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.</p>
        </div>
        <button onClick={() => setModal({ open: true, editing: null })} className="btn-primary"><Plus className="h-4 w-4" /> New lesson</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[["Published", count("published")], ["In review", count("pending")], ["Rejected", count("rejected")]].map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-2xl font-display font-bold">{v}</p><p className="text-xs text-ink-light/60 dark:text-ink-dark/50">{l}</p></div>
        ))}
      </div>

      {trust && (
        <div className={`rounded-xl border p-4 mb-6 text-sm ${trust.trusted ? "border-success/40 bg-success/10" : "border-brand-500/30 bg-brand-500/10"}`}>
          {trust.trusted
            ? <p><span className="font-semibold">Trusted creator.</span> Clean lessons you upload are published instantly (a few are randomly spot-checked).</p>
            : <>
                <p><span className="font-semibold">Build trust to publish instantly.</span> Lessons are reviewed by an admin until you have {trust.needed} approved lessons and no rejections.</p>
                <div className="h-1.5 mt-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden max-w-xs"><div className="h-full bg-brand-500" style={{ width: `${Math.min(100, (trust.published / trust.needed) * 100)}%` }} /></div>
                <p className="text-xs mt-1 text-ink-light/60 dark:text-ink-dark/50">{Math.min(trust.published, trust.needed)} / {trust.needed} approved{trust.rejected ? ` - ${trust.rejected} rejected lesson(s) must be fixed or removed` : ""}</p>
              </>}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} className="h-20 w-full" />)}</div>
      ) : reels.length === 0 ? (
        <EmptyState icon={Film} title="No lessons yet" description="Upload your first video lesson. An admin will review it before it goes live." actionLabel="Upload a lesson" onAction={() => setModal({ open: true, editing: null })} />
      ) : (
        <div className="space-y-3">
          {reels.map((r) => (
            <div key={r._id} className="card p-3 flex gap-4 items-center">
              <div className="h-20 w-14 rounded-lg overflow-hidden bg-surface-card-dark shrink-0">
                {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{r.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-ink-light/60 dark:text-ink-dark/50">
                  <StatusBadge status={r.status} /><span>{r.category?.name}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{r.views}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{r.likes?.length ?? 0}</span>
                </div>
                {r.status === "rejected" && r.rejectionReason && <p className="text-xs text-error mt-1">Reason: {r.rejectionReason}</p>}
                {r.status === "pending" && r.reportCount > 0 && <p className="text-xs text-gold-500 mt-1">Hidden after reports from viewers - an admin will review it.</p>}
                {r.status === "pending" && !r.reportCount && r.autoDecision === "needs-review" && <p className="text-xs text-gold-500 mt-1">Flagged for a closer look: {(r.moderationNotes || []).join("; ")}</p>}
                {r.autoDecision === "auto-approved" && r.status === "published" && <p className="text-xs text-success mt-1">Auto-approved</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link to={`/reels/${r._id}`} className="btn-ghost" title="Preview" aria-label="Preview"><Eye className="h-4 w-4" /></Link>
                <button onClick={() => setModal({ open: true, editing: r })} className="btn-ghost" title="Edit" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(r)} className="btn-ghost hover:!text-error" title="Delete" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LessonFormModal open={modal.open} editing={modal.editing} categories={categories} isAdmin={user?.role === "admin"} onClose={() => setModal({ open: false, editing: null })} onSaved={load} />
    </div>
  );
};

export default Studio;
