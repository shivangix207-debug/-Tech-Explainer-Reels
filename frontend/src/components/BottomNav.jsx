import { NavLink } from "react-router-dom";
import { Home, Compass, LayoutDashboard, User, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const BottomNav = () => {
  const { user } = useAuth();

  const items = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/reels", label: "Explore", icon: Compass },
    { to: user ? "/dashboard" : "/login", label: "Dashboard", icon: LayoutDashboard },
    user?.role === "admin"
      ? { to: "/admin", label: "Admin", icon: ShieldCheck }
      : { to: user ? "/profile" : "/login", label: "Profile", icon: User },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-md border-t border-surface-border dark:border-surface-border-dark"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? "text-brand-600" : "text-ink-light/50 dark:text-ink-dark/50"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
