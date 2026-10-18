import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

const NotFound = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 animate-fade-in">
    <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
      <Compass className="h-8 w-8 text-brand-500" />
    </div>
    <h1 className="text-6xl font-display font-extrabold text-brand-600">404</h1>
    <p className="mt-2 text-lg font-medium">Page not found</p>
    <p className="text-ink-light/60 dark:text-ink-dark/50 mt-1">The page you're looking for doesn't exist.</p>
    <Link to="/" className="btn-primary mt-6">Back to Home</Link>
  </div>
);

export default NotFound;
