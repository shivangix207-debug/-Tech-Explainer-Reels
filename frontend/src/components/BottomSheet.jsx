import { X } from "lucide-react";
import { useEffect } from "react";

const BottomSheet = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-card dark:bg-surface-card-dark rounded-t-3xl shadow-prominent max-h-[85vh] flex flex-col animate-sheet-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border dark:border-surface-border-dark shrink-0">
          <div className="mx-auto h-1 w-10 rounded-full bg-surface-border dark:bg-surface-border-dark absolute top-2 left-1/2 -translate-x-1/2" />
          <h3 className="font-display font-semibold text-base mt-1">{title}</h3>
          <button onClick={onClose} className="text-ink-light/50 dark:text-ink-dark/50 hover:text-ink-light dark:hover:text-ink-dark mt-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">{children}</div>
      </div>
    </div>
  );
};

export default BottomSheet;
