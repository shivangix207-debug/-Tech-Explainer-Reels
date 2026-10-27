import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Film, FolderKanban, Users, MessageSquare, ArrowLeft } from "lucide-react";
import Logo from "../components/Logo";

const navItems = [
  { to: "/admin", label: "Analytics", icon: LayoutDashboard, end: true },
  { to: "/admin/reels", label: "Reels", icon: Film },
  { to: "/admin/categories", label: "Categories", icon: FolderKanban },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/comments", label: "Comments", icon: MessageSquare },
];

const AdminLayout = () => (
  <div className="min-h-screen flex bg-surface-light dark:bg-surface-dark">
    <aside className="w-60 shrink-0 border-r border-surface-border dark:border-surface-border-dark p-4 hidden md:flex flex-col">
      <NavLink to="/" className="flex items-center gap-2 mb-8 text-sm font-medium text-ink-light/50 dark:text-ink-dark/50 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to site
      </NavLink>
      <div className="mb-6 px-2">
        <Logo size={26} showWordmark={false} />
      </div>
      <p className="text-xs font-semibold text-ink-light/40 dark:text-ink-dark/40 uppercase tracking-wide mb-2 px-2">Admin Panel</p>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive ? "bg-brand-600 text-white" : "text-ink-light/70 dark:text-ink-dark/70 hover:bg-black/5 dark:hover:bg-white/10"
              }`
            }
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <main className="flex-1 p-6 overflow-x-hidden">
      <Outlet />
    </main>
  </div>
);

export default AdminLayout;
