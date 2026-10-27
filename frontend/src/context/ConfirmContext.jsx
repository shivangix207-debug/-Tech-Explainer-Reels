import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle } from "lucide-react";

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null); // { title, message, confirmLabel, danger, resolve }

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        title: options?.title || "Are you sure?",
        message: options?.message || "This action cannot be undone.",
        confirmLabel: options?.confirmLabel || "Confirm",
        cancelLabel: options?.cancelLabel || "Cancel",
        danger: options?.danger !== false,
        resolve,
      });
    });
  }, []);

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => close(false)} />
          <div className="relative card-elevated w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${state.danger ? "bg-error/10 text-error" : "bg-brand-500/10 text-brand-600"}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-base">{state.title}</h3>
                <p className="text-sm text-ink-light/70 dark:text-ink-dark/70 mt-1">{state.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => close(false)}>{state.cancelLabel}</button>
              <button
                className={state.danger ? "inline-flex items-center justify-center gap-2 rounded-xl bg-error px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition" : "btn-primary"}
                onClick={() => close(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
};
