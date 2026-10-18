const STYLES = {
  published: "bg-success/15 text-success",
  pending: "bg-gold-400/20 text-gold-500",
  rejected: "bg-error/15 text-error",
  draft: "bg-black/5 dark:bg-white/10 text-ink-light/70 dark:text-ink-dark/70",
  scheduled: "bg-accent-500/15 text-accent-500",
};
const LABELS = { pending: "Pending review" };

const StatusBadge = ({ status = "published" }) => (
  <span className={`badge capitalize ${STYLES[status] || STYLES.draft}`}>{LABELS[status] || status}</span>
);
export default StatusBadge;
