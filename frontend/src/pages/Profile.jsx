import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authApi, bookmarksApi, categoriesApi } from "../services/endpoints";
import ReelCard from "../components/ReelCard";
import EmptyState from "../components/EmptyState";
import { SkeletonReelGrid } from "../components/Skeletons";
import { Bookmark, ExternalLink } from "lucide-react";

const Profile = () => {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name || "",
    bio: user?.bio || "",
    skillLevel: user?.skillLevel || "beginner",
    interests: user?.interests?.map((i) => i._id || i) || [],
    leaderboardOptIn: user?.leaderboardOptIn ?? true,
  });
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    bookmarksApi.list().then(({ data }) => setBookmarks(data.bookmarks)).finally(() => setLoading(false));
    categoriesApi.list().then(({ data }) => setCategories(data.categories));
  }, []);

  const toggleInterest = (id) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(id) ? f.interests.filter((i) => i !== id) : [...f.interests, id],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authApi.updateMe(form);
      setUser(data.user);
      localStorage.setItem("ter_user", JSON.stringify(data.user));
      toast("Profile saved", "success");
    } catch {
      toast("Couldn't save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      await authApi.changePassword(pw);
      setPw({ currentPassword: "", newPassword: "" });
      toast("Password updated", "success");
    } catch (err) {
      toast(err.response?.data?.message || "Couldn't update password", "error");
    } finally { setPwSaving(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="card p-6 h-fit">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-bold">{user?.name}</p>
              <p className="text-sm text-ink-light/60 dark:text-ink-dark/50">{user?.email}</p>
              <span className="badge bg-brand-500/15 text-brand-500 mt-1 capitalize">{user?.role === "user" ? "student" : user?.role}</span>
            </div>
          </div>

          <Link to={`/u/${user?.id}`} className="text-xs font-medium text-brand-600 flex items-center gap-1 hover:underline mb-4">
            View public profile <ExternalLink className="h-3 w-3" />
          </Link>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Bio</label>
              <textarea className="input" rows={3} maxLength={200} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Skill level</label>
              <select className="input" value={form.skillLevel} onChange={(e) => setForm({ ...form, skillLevel: e.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Interests</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c._id}
                    onClick={() => toggleInterest(c._id)}
                    className={`badge border ${form.interests.includes(c._id) ? "bg-brand-600 text-white border-brand-600" : "border-surface-border dark:border-surface-border-dark"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.leaderboardOptIn} onChange={(e) => setForm({ ...form, leaderboardOptIn: e.target.checked })} />
              Show me on the XP leaderboard
            </label>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>

          <form onSubmit={changePassword} className="space-y-3 mt-6 pt-6 border-t border-surface-border dark:border-surface-border-dark">
            <p className="text-sm font-semibold">Change password</p>
            <input type="password" required autoComplete="current-password" placeholder="Current password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" placeholder="New password (8+ characters)" className="input" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            <button type="submit" disabled={pwSaving} className="btn-secondary w-full">{pwSaving ? "Updating..." : "Update password"}</button>
          </form>
        </div>

        <div className="md:col-span-2">
          <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2"><Bookmark className="h-5 w-5" /> Your Bookmarks</h2>
          {loading ? (
            <SkeletonReelGrid count={6} />
          ) : bookmarks.length === 0 ? (
            <EmptyState icon={Bookmark} title="No bookmarks yet" description="Save reels to watch later — they'll show up here." actionLabel="Explore reels" actionTo="/reels" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {bookmarks.filter((b) => b.reel).map((b) => <ReelCard key={b._id} reel={b.reel} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
