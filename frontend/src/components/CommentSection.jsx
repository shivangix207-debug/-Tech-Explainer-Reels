import { useEffect, useState } from "react";
import { MessageCircle, Trash2, Pencil, Check, X, Heart } from "lucide-react";
import { commentsApi } from "../services/endpoints";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { SkeletonCommentList } from "./Skeletons";
import EmptyState from "./EmptyState";

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const CommentSection = ({ reelId }) => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [reacted, setReacted] = useState({});

  const load = () =>
    commentsApi.list(reelId).then(({ data }) => {
      setComments(data.comments);
      const map = {};
      data.comments.forEach((c) => {
        map[c._id] = user ? (c.reactions || []).some((id) => id === user.id || id?._id === user.id) : false;
      });
      setReacted(map);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, [reelId]);

  const addComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const { data } = await commentsApi.add(reelId, text.trim());
    setComments([data.comment, ...comments]);
    setText("");
    toast("Comment posted", "success");
  };

  const saveEdit = async (id) => {
    const { data } = await commentsApi.update(id, editText);
    setComments(comments.map((c) => (c._id === id ? data.comment : c)));
    setEditingId(null);
    toast("Comment updated", "success");
  };

  const remove = async (id) => {
    const ok = await confirm({ title: "Delete comment?", message: "This can't be undone.", confirmLabel: "Delete" });
    if (!ok) return;
    await commentsApi.remove(id);
    setComments(comments.filter((c) => c._id !== id));
    toast("Comment deleted", "success");
  };

  const react = async (id) => {
    if (!user) return toast("Log in to react to comments", "info");
    const was = reacted[id];
    setReacted((r) => ({ ...r, [id]: !was }));
    setComments((cs) => cs.map((c) => (c._id === id ? { ...c, reactionCount: (c.reactionCount || 0) + (was ? -1 : 1) } : c)));
    try {
      await commentsApi.react(id);
    } catch {
      setReacted((r) => ({ ...r, [id]: was }));
      toast("Couldn't update reaction", "error");
    }
  };

  return (
    <div className="card p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-4"><MessageCircle className="h-5 w-5 text-brand-600" /> Comments ({comments.length})</h3>

      {user ? (
        <form onSubmit={addComment} className="flex gap-2 mb-5">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..." className="input flex-1" />
          <button type="submit" className="btn-primary">Post</button>
        </form>
      ) : (
        <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mb-5">Log in to join the discussion.</p>
      )}

      {loading ? (
        <SkeletonCommentList />
      ) : comments.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No comments yet" description="Be the first to share your thoughts." />
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const isOwner = user && c.user?._id === user.id;
            const canDelete = isOwner || user?.role === "admin";
            return (
              <div key={c._id} className="flex gap-3 stagger-item">
                <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-semibold shrink-0">
                  {c.user?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.user?.name || "Deleted user"}</span>
                    <span className="text-xs text-ink-light/45">{timeAgo(c.createdAt)}{c.edited ? " (edited)" : ""}</span>
                  </div>

                  {editingId === c._id ? (
                    <div className="flex gap-2 mt-1">
                      <input value={editText} onChange={(e) => setEditText(e.target.value)} className="input py-1.5 flex-1" />
                      <button onClick={() => saveEdit(c._id)} className="text-success"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditingId(null)} className="text-ink-light/45"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <p className="text-sm mt-0.5">{c.text}</p>
                  )}

                  <div className="flex items-center gap-3 mt-1">
                    <button onClick={() => react(c._id)} className={`text-xs flex items-center gap-1 ${reacted[c._id] ? "text-accent-500" : "text-ink-light/45 hover:text-accent-500"}`}>
                      <Heart className="h-3 w-3" fill={reacted[c._id] ? "currentColor" : "none"} /> {c.reactionCount || 0}
                    </button>
                    {isOwner && editingId !== c._id && (
                      <button onClick={() => { setEditingId(c._id); setEditText(c.text); }} className="text-xs text-ink-light/45 hover:text-brand-600 flex items-center gap-1">
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </div>
                </div>
                {canDelete && (
                  <button onClick={() => remove(c._id)} className="text-ink-light/40 hover:text-error shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
