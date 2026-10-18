import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { adminApi, commentsApi } from "../../services/endpoints";
import Spinner from "../../components/Spinner";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

const AdminComments = () => {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.comments().then(({ data }) => setComments(data.comments)).finally(() => setLoading(false));
  }, []);

  const remove = async (id) => {
    const ok = await confirmDialog({ title: "Delete this comment?", message: "This cannot be undone.", confirmLabel: "Delete" });
    if (!ok) return;
    await commentsApi.remove(id);
    setComments(comments.filter((c) => c._id !== id));
    toast("Comment deleted", "success");
  };

  if (loading) return <Spinner full />;

  return (
    <div>
      <h1 className="text-2xl font-display font-bold mb-6">Moderate Comments</h1>
      <div className="card divide-y divide-surface-border dark:divide-surface-border-dark">
        {comments.length === 0 && <p className="p-5 text-sm text-ink-light/45">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c._id} className="flex items-start justify-between gap-4 p-4">
            <div>
              <p className="text-sm">{c.text}</p>
              <p className="text-xs text-ink-light/45 mt-1">
                {c.user?.name} on <span className="font-medium">{c.reel?.title}</span> &middot; {new Date(c.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button onClick={() => remove(c._id)} className="text-ink-light/40 hover:text-error shrink-0"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminComments;
