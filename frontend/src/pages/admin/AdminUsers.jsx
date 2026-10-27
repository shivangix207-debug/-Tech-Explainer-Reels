import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { adminApi } from "../../services/endpoints";
import Spinner from "../../components/Spinner";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

const AdminUsers = () => {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminApi.users().then(({ data }) => setUsers(data.users)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const fail = (err, fallback) => toast(err.response?.data?.message || fallback, "error");

  const toggleActive = async (u) => {
    try {
      const { data } = await adminApi.updateUser(u.id, { isActive: !u.isActive });
      setUsers(users.map((x) => (x.id === u.id ? data.user : x)));
      toast(data.user.isActive ? "User enabled" : "User disabled", "success");
    } catch (err) { fail(err, "Couldn't update the user"); }
  };

  const changeRole = async (u, role) => {
    try {
      const { data } = await adminApi.updateUser(u.id, { role });
      setUsers(users.map((x) => (x.id === u.id ? data.user : x)));
      toast(`${u.name} is now ${role === "user" ? "a student" : `a${role === "admin" ? "n" : ""} ${role}`}`, "success");
    } catch (err) { fail(err, "Couldn't change the role"); }
  };

  const toggleTrusted = async (u) => {
    try {
      const { data } = await adminApi.updateUser(u.id, { trusted: !u.trusted });
      setUsers(users.map((x) => (x.id === u.id ? data.user : x)));
      toast(data.user.trusted ? `${u.name} is now a trusted creator` : `${u.name} is no longer trusted`, "success");
    } catch (err) { fail(err, "Couldn't update trust"); }
  };

  const remove = async (u) => {
    const ok = await confirmDialog({ title: `Delete ${u.name}?`, message: "Their comments, progress and quiz results are removed too. This cannot be undone.", confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await adminApi.deleteUser(u.id);
      setUsers(users.filter((x) => x.id !== u.id));
      toast("User deleted", "success");
    } catch (err) { fail(err, "Couldn't delete the user"); }
  };

  if (loading) return <Spinner full />;

  return (
    <div>
      <h1 className="text-2xl font-display font-bold mb-6">Manage Users</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-light/60 dark:text-ink-dark/50 border-b border-surface-border dark:border-surface-border-dark">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border dark:divide-surface-border-dark">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-ink-light/60 dark:text-ink-dark/50">{u.email}</td>
                <td className="px-4 py-3">
                  <select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => changeRole(u, e.target.value)} className="input !w-auto !py-1 !px-2 text-xs">
                    <option value="user">Student</option><option value="creator">Creator</option><option value="admin">Admin</option>
                  </select>
                  {u.role === "creator" && (
                    <button onClick={() => toggleTrusted(u)} title="Trusted creators' clean lessons publish instantly" className={`ml-2 badge ${u.trusted ? "bg-success/15 text-success" : "bg-black/5 dark:bg-white/10 text-ink-light/60 dark:text-ink-dark/50"}`}>
                      {u.trusted ? "Trusted" : "Trust"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.isActive !== false ? "bg-success/15 text-success" : "bg-error/15 text-error"}`}>
                    {u.isActive !== false ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-light/45 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => toggleActive(u)} title="Toggle active status" className="text-xs font-medium text-ink-light/45 hover:text-warning">
                    {u.isActive !== false ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => remove(u)} aria-label={`Delete ${u.name}`} className="text-ink-light/45 hover:text-error"><Trash2 className="h-4 w-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
