"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmWord, // if required e.g. "DELETE"
  confirmLabel = "Confirm",
  danger = true,
  onConfirm,
  onCancel,
  loading = false,
}) {
  const [typedWord, setTypedWord] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTypedWord("");
      const handleKeyDown = (e) => {
        if (e.key === "Escape") onCancel();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const canConfirm = !confirmWord || typedWord.trim().toUpperCase() === confirmWord.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onCancel}
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Dialog card */}
      <div className="relative w-full max-w-md bg-surface text-ink border border-border rounded-3xl p-6 shadow-2xl z-10 animate-slide-in">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                danger ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-normal text-ink">{title}</h3>
              <p className="text-xs text-ink-muted">Action verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-soft transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-ink-secondary mb-4 leading-relaxed break-words">
          {description}
        </p>

        {confirmWord && (
          <div className="mb-5 space-y-2">
            <label className="block text-xs font-medium text-ink-secondary">
              Type <strong className="font-mono text-danger font-bold">{confirmWord}</strong> to confirm:
            </label>
            <input
              type="text"
              value={typedWord}
              onChange={(e) => setTypedWord(e.target.value)}
              placeholder={confirmWord}
              className="w-full h-10 px-3 rounded-xl border border-border bg-surface-soft text-ink text-sm font-mono focus:border-danger focus:outline-none uppercase"
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-full border border-border hover:bg-surface-soft text-xs font-medium text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              danger ? "bg-danger hover:bg-danger-hover" : "bg-accent hover:bg-accent-hover"
            }`}
          >
            {loading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
