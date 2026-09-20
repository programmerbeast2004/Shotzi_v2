"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, "success", dur),
    error: (msg, dur) => addToast(msg, "error", dur),
    info: (msg, dur) => addToast(msg, "info", dur),
    warning: (msg, dur) => addToast(msg, "warning", dur),
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-[calc(100vw-3rem)]"
        aria-live="polite"
        role="region"
      >
        {toasts.map((t) => {
          let icon = <Info className="w-4 h-4 text-accent shrink-0" />;
          let borderClass = "border-border";
          let bgClass = "bg-surface";

          if (t.type === "success") {
            icon = <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
          } else if (t.type === "error") {
            icon = <AlertCircle className="w-4 h-4 text-danger shrink-0" />;
          } else if (t.type === "warning") {
            icon = <AlertCircle className="w-4 h-4 text-warning shrink-0" />;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${borderClass} ${bgClass} text-ink shadow-lg shadow-ink/5 animate-slide-in backdrop-blur-sm`}
            >
              <div className="mt-0.5">{icon}</div>
              <p className="text-sm font-medium leading-snug flex-1 break-words">
                {t.message}
              </p>
              <button
                onClick={() => removeToast(t.id)}
                className="text-ink-muted hover:text-ink transition-colors p-0.5 rounded"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Silent no-op fallback when used outside provider (production safe)
    const noop = () => {};
    return { success: noop, error: noop, info: noop, warning: noop, dismiss: noop };
  }
  return context;
}
