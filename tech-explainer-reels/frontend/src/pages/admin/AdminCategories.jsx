import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { categoriesApi } from "../../services/endpoints";
import Spinner from "../../components/Spinner";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

const AdminCategories = () => {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#7C3AED" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    categoriesApi.list().then(({ data }) => setCategories(data.categories)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await categoriesApi.create(form);
      setModalOpen(false);
      setForm({ name: "", description: "", color: "#7C3AED" });
      load();
      toast("Category created", "success");
    } catch (err) {
      toast(err.response?.data?.message || "Couldn't create category", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setError("");
    const ok = await confirmDialog({ title: "Delete this category?", message: "Reels in this category will be unaffected, but the category will be removed.", confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await categoriesApi.remove(id);
      setCategories(categories.filter((c) => c._id !== id));
      toast("Category deleted", "success");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't delete this category.");
      toast(err.response?.data?.message || "Couldn't delete category", "error");
    }
  };

  if (loading) return <Spinner full />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Manage Categories</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New Category</button>
      </div>

      {error && <p className="text-sm text-error mb-4">{error}</p>}

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((c) => (
          <div key={c._id} className="card p-5 flex items-start justify-between">
            <div>
              <div className="h-8 w-8 rounded-lg mb-2" style={{ backgroundColor: c.color }} />
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-ink-light/60 dark:text-ink-dark/50">{c.reelCount} reels</p>
            </div>
            <button onClick={() => handleDelete(c._id)} className="text-ink-light/40 hover:text-error"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">New Category</h2>
              <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input required placeholder="Category name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea placeholder="Description (optional)" rows={2} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Color</label>
                <input type="color" className="h-9 w-14 rounded-lg border border-surface-border dark:border-surface-border-dark" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Saving..." : "Create Category"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
