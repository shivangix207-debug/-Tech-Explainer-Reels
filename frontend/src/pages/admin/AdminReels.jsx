import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, BarChart3, CheckSquare, Square, Check, Ban, Eye } from "lucide-react";
import { reelsApi, categoriesApi, adminApi } from "../../services/endpoints";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { SkeletonRow } from "../../components/Skeletons";
import LessonFormModal from "../../components/LessonFormModal";
import StatusBadge from "../../components/StatusBadge";

const FILTERS = [["pending", "Needs review"], ["flagged", "Flagged"], ["spot", "Spot-check"], ["published", "Published"], ["rejected", "Rejected"], ["", "All"]];
const PARAMS = { pending: { status: "pending" }, flagged: { flagged: 1 }, spot: { spotcheck: 1 }, published: { status: "published" }, rejected: { status: "rejected" }, "": {} };
const HIGH_RISK = 40; // keep in sync with MODERATION_REVIEW_RISK on the server

// Admin: moderation queue + management of every lesson.
const AdminReels = () => {
  const confirm = useConfirm();
  const toast = useToast();
  const [reels, setReels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [reject, setReject] = useState(null); // { reel, reason }

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.reels(PARAMS[filter]), categoriesApi.list()])
      .then(([r, c]) => { setReels(r.data.reels); setCategories(c.data.categories); setSelected([]); })
      .catch(() => toast("Couldn't load lessons", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const setStatus = async (r, status, reason) => {
    try { await adminApi.moderateReel(r._id, status, reason); toast(status === "published" ? "Lesson published" : "Lesson updated", "success"); load(); }
    catch (err) { toast(err.response?.data?.message || "Action failed", "error"); }
  };

  const del = async (r) => {
    if (!(await confirm({ title: `Delete "${r.title}"?`, message: "This removes the lesson, its video file, comments and progress. It cannot be undone.", confirmLabel: "Delete" }))) return;
    try { await reelsApi.remove(r._id); toast("Lesson deleted", "success"); load(); }
    catch (err) { toast(err.response?.data?.message || "Couldn't delete", "error"); }
  };

  const bulk = async (action) => {
    if (action === "delete" && !(await confirm({ title: `Delete ${selected.length} lesson(s)?`, message: "This cannot be undone.", confirmLabel: "Delete" }))) return;
    try { await adminApi.bulkReelAction(selected, action); toast("Done", "success"); load(); }
    catch (err) { toast(err.response?.data?.message || "Bulk action failed", "error"); }
  };

  const clean = reels.filter((r) => r.status === "pending" && (r.risk || 0) < HIGH_RISK && !r.reportCount);
  const approveClean = async () => {
    if (!(await confirm({ title: `Publish ${clean.length} clean lesson(s)?`, message: "These passed automatic screening with low risk and have no reports. Flagged and reported lessons are NOT included.", confirmLabel: "Approve all clean" }))) return;
    try { const { data } = await adminApi.approveClean(); toast(`Published ${data.approved} lesson(s)`, "success"); load(); }
    catch (err) { toast(err.response?.data?.message || "Couldn't approve", "error"); }
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold">Lessons & moderation</h1>
        <div className="flex gap-2">
          {filter === "pending" && <button onClick={approveClean} disabled={clean.length === 0} className="btn-secondary"><Check className="h-4 w-4" /> Approve all clean ({clean.length})</button>}
          <button onClick={() => setModal({ open: true, editing: null })} className="btn-primary"><Plus className="h-4 w-4" /> New lesson</button>
        </div>
      </div>
      <p className="text-xs text-ink-light/60 dark:text-ink-dark/50 mb-4 -mt-2">Queues are sorted riskiest first. Uploads are screened automatically; trusted creators publish instantly, and lessons reported by 3+ viewers are hidden and appear under Flagged.</p>

      <div className="flex gap-1 mb-4 overflow-x-auto card p-1">
        {FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${filter === v ? "bg-brand-600 text-white" : "text-ink-light/60 dark:text-ink-dark/60 hover:bg-brand-500/10"}`}>{l}</button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="flex items-center gap-2 mb-4 card px-4 py-3 flex-wrap">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <button onClick={() => bulk("publish")} className="btn-secondary py-1.5 px-3 text-xs">Publish</button>
          <button onClick={() => bulk("reject")} className="btn-secondary py-1.5 px-3 text-xs">Reject</button>
          <button onClick={() => bulk("unpublish")} className="btn-secondary py-1.5 px-3 text-xs">Unpublish</button>
          <button onClick={() => bulk("delete")} className="btn-secondary py-1.5 px-3 text-xs !text-error !border-error/40">Delete</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-light/60 dark:text-ink-dark/50 border-b border-surface-border dark:border-surface-border-dark">
            <tr>
              <th className="px-4 py-3 w-8"><button aria-label="Select all" onClick={() => setSelected(selected.length === reels.length ? [] : reels.map((r) => r._id))}>{selected.length === reels.length && reels.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</button></th>
              <th className="px-4 py-3">Title</th><th className="px-4 py-3">Author</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Views</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border dark:divide-surface-border-dark">
            {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><SkeletonRow className="h-5 w-full" /></td></tr>)
              : reels.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-light/55 dark:text-ink-dark/50">No lessons in this view.</td></tr>
              : reels.map((r) => (
                <tr key={r._id}>
                  <td className="px-4 py-3"><button aria-label="Select" onClick={() => toggle(r._id)}>{selected.includes(r._id) ? <CheckSquare className="h-4 w-4 text-brand-500" /> : <Square className="h-4 w-4" />}</button></td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium truncate">{r.title}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {r.autoDecision && r.autoDecision !== "admin" && <span className="badge bg-black/5 dark:bg-white/10 text-ink-light/70 dark:text-ink-dark/60">{r.autoDecision.replace("-", " ")}</span>}
                      {r.status !== "published" || r.risk > 0 ? <span className={`badge ${(r.risk || 0) >= HIGH_RISK ? "bg-error/15 text-error" : "bg-success/15 text-success"}`}>{(r.risk || 0) >= HIGH_RISK ? `High risk ${r.risk}` : `Low risk ${r.risk || 0}`}</span> : null}
                      {r.reportCount > 0 && <span className="badge bg-error/15 text-error">{r.reportCount} report{r.reportCount > 1 ? "s" : ""}</span>}
                      {r.uploadedBy?.trusted && <span className="badge bg-success/15 text-success">trusted creator</span>}
                    </div>
                    {r.moderationNotes?.length > 0 && <p className="text-[11px] mt-1 text-ink-light/60 dark:text-ink-dark/50 whitespace-normal">{r.moderationNotes.join(" · ")}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink-light/70 dark:text-ink-dark/60">{r.uploadedBy?.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">{r.views}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                    {r.status !== "published" && <button onClick={() => setStatus(r, "published")} title="Approve & publish" aria-label="Approve" className="btn-ghost !px-2 text-success"><Check className="h-4 w-4" /></button>}
                    {r.status !== "rejected" && <button onClick={() => setReject({ reel: r, reason: "" })} title="Reject" aria-label="Reject" className="btn-ghost !px-2 text-error"><Ban className="h-4 w-4" /></button>}
                    <Link to={`/reels/${r._id}`} title="Preview" className="btn-ghost !px-2"><Eye className="h-4 w-4" /></Link>
                    <Link to={`/admin/reels/${r._id}`} title="Analytics" className="btn-ghost !px-2"><BarChart3 className="h-4 w-4" /></Link>
                    <button onClick={() => setModal({ open: true, editing: r })} title="Edit" aria-label="Edit" className="btn-ghost !px-2"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => del(r)} title="Delete" aria-label="Delete" className="btn-ghost !px-2 hover:!text-error"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {reject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="card-elevated w-full max-w-md p-6 animate-scale-in">
            <h2 className="font-display font-bold mb-1">Reject "{reject.reel.title}"</h2>
            <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mb-3">The creator will see this reason in their Studio.</p>
            <textarea className="input" rows={3} maxLength={300} placeholder="Reason (optional)" value={reject.reason} onChange={(e) => setReject({ ...reject, reason: e.target.value })} />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setReject(null)}>Cancel</button>
              <button className="btn-primary" onClick={async () => { await setStatus(reject.reel, "rejected", reject.reason); setReject(null); }}>Reject lesson</button>
            </div>
          </div>
        </div>
      )}

      <LessonFormModal open={modal.open} editing={modal.editing} categories={categories} isAdmin onClose={() => setModal({ open: false, editing: null })} onSaved={load} />
    </div>
  );
};

export default AdminReels;
