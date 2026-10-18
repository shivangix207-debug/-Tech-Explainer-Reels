import { Link } from "react-router-dom";
import Logo from "./Logo";

const Footer = () => (
  <footer className="border-t border-surface-border dark:border-surface-border-dark mt-20 pb-16 md:pb-0">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
      <Logo size={28} />
      <p className="text-sm text-ink-light/60 dark:text-ink-dark/60">Learn tech concepts in 60 seconds, powered by AI.</p>
      <div className="flex gap-4 text-sm text-ink-light/60 dark:text-ink-dark/60">
        <Link to="/watch" className="hover:text-brand-600">Watch</Link>
        <Link to="/reels" className="hover:text-brand-600">Explore</Link>
        <Link to="/categories" className="hover:text-brand-600">Categories</Link>
      </div>
    </div>
  </footer>
);

export default Footer;
