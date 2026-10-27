import { Link } from "react-router-dom";

const EmptyState = ({ icon: Icon, title, description, actionLabel, actionTo, onAction }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-fade-in">
    <div className="h-16 w-16 rounded-2xl gradient-hero bg-brand-500/10 flex items-center justify-center mb-4">
      {Icon && <Icon className="h-8 w-8 text-brand-500" />}
    </div>
    <h3 className="font-display font-semibold text-lg">{title}</h3>
    {description && <p className="text-sm text-ink-light/60 dark:text-ink-dark/60 mt-1.5 max-w-sm">{description}</p>}
    {actionLabel && actionTo && (
      <Link to={actionTo} className="btn-primary mt-5">
        {actionLabel}
      </Link>
    )}
    {actionLabel && onAction && !actionTo && (
      <button onClick={onAction} className="btn-primary mt-5">
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
