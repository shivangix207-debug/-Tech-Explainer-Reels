import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Moon, Sun, Menu, X, User, LogOut, LayoutDashboard, ShieldCheck, Command, Film } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Logo from "./Logo";

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/reels?search=${encodeURIComponent(search)}`);
    setMenuOpen(false);
  };

  const openPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border/70 dark:border-surface-border-dark bg-surface-light/85 dark:bg-surface-dark/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-light/40 dark:text-ink-dark/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reels, topics, categories..."
              className="input pl-9 pr-16"
            />
            <button
              type="button"
              onClick={openPalette}
              className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-ink-light/50 dark:text-ink-dark/50"
            >
              <Command className="h-3 w-3" />K
            </button>
          </form>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/watch" className="px-3 py-2 text-sm font-medium text-ink-light/70 dark:text-ink-dark/70 hover:text-brand-600 flex items-center gap-1.5">
              <Film className="h-4 w-4" /> Watch
            </Link>
            <Link to="/reels" className="px-3 py-2 text-sm font-medium text-ink-light/70 dark:text-ink-dark/70 hover:text-brand-600">
              Explore
            </Link>
            <Link to="/categories" className="px-3 py-2 text-sm font-medium text-ink-light/70 dark:text-ink-dark/70 hover:text-brand-600">
              Categories
            </Link>

            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full bg-black/5 dark:bg-white/10 pl-1 pr-3 py-1"
                >
                  <div className="h-7 w-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-semibold">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{user.name?.split(" ")[0]}</span>
                </button>
                {profileOpen && (
                  <div
                    className="absolute right-0 mt-2 w-52 card-elevated p-2 animate-scale-in"
                    onMouseLeave={() => setProfileOpen(false)}
                  >
                    <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                    <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    <Link to="/library" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">Library</Link>
                    {(user.role === "creator" || user.role === "admin") && (
                      <Link to="/studio" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">Creator Studio</Link>
                    )}
                    {user.role === "admin" && (
                      <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                        <ShieldCheck className="h-4 w-4" /> Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        logout();
                        navigate("/");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-error/10 text-error"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-secondary py-2 px-4">Log in</Link>
                <Link to="/signup" className="btn-primary py-2 px-4">Sign up</Link>
              </div>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-surface-border dark:border-surface-border-dark px-4 py-4 space-y-3 animate-slide-down">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-light/40 dark:text-ink-dark/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reels..." className="input pl-9" />
          </form>
          <Link to="/watch" onClick={() => setMenuOpen(false)} className="block py-2 font-medium">Watch</Link>
          <Link to="/reels" onClick={() => setMenuOpen(false)} className="block py-2 font-medium">Explore</Link>
          <Link to="/categories" onClick={() => setMenuOpen(false)} className="block py-2 font-medium">Categories</Link>
          {user ? (
            <>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block py-2 font-medium">Dashboard</Link>
              <Link to="/library" onClick={() => setMenuOpen(false)} className="block py-2 font-medium">Library</Link>
              {(user.role === "creator" || user.role === "admin") && (
                <Link to="/studio" onClick={() => setMenuOpen(false)} className="block py-2 font-medium">Creator Studio</Link>
              )}
              {user.role === "admin" && (
                <Link to="/admin" onClick={() => setMenuOpen(false)} className="block py-2 font-medium">Admin Panel</Link>
              )}
              <button onClick={() => { logout(); setMenuOpen(false); navigate("/"); }} className="block py-2 font-medium text-error">
                Logout
              </button>
            </>
          ) : (
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="btn-secondary flex-1 justify-center" onClick={() => setMenuOpen(false)}>Log in</Link>
              <Link to="/signup" className="btn-primary flex-1 justify-center" onClick={() => setMenuOpen(false)}>Sign up</Link>
            </div>
          )}
          <button onClick={toggleTheme} className="flex items-center gap-2 py-2 font-medium">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />} Toggle theme
          </button>
        </div>
      )}
    </header>
  );
};

export default Navbar;
