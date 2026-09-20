"use client";

import { useTheme, THEMES } from "./ThemeProvider";
import { Check, Sparkles } from "lucide-react";
import { useToast } from "./Toast";

export default function ThemeSelector({ className = "" }) {
  const { currentTheme, setTheme, isPersisting } = useTheme();
  const toast = useToast();

  const handleSelect = async (themeId) => {
    if (themeId === currentTheme) return;
    const chosen = THEMES.find((t) => t.id === themeId);
    await setTheme(themeId);
    toast.success(`Theme set to ${chosen?.name || themeId}`);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-2xl font-normal text-ink">Appearance</h3>
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <p className="text-sm text-ink-secondary mt-1">
            Choose your Shotzi atmosphere. Persists across your sessions and devices.
          </p>
        </div>
        {isPersisting && (
          <span className="text-xs text-accent animate-pulse font-medium">
            Saving...
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {THEMES.map((t) => {
          const isSelected = currentTheme === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelect(t.id)}
              className={`group text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? "border-accent ring-2 ring-accent/20 shadow-md bg-surface"
                  : "border-border hover:border-border-hover bg-surface-soft hover:bg-surface"
              }`}
              style={{ minHeight: "180px" }}
            >
              {/* Mini visual mockup of theme atmosphere */}
              <div
                className="w-full h-20 rounded-xl p-2.5 border mb-3 flex flex-col justify-between transition-transform duration-300 group-hover:scale-[1.01]"
                style={{
                  backgroundColor: t.bg,
                  borderColor: t.border,
                }}
              >
                <div className="flex items-center justify-between">
                  {/* Miniature card inside preview */}
                  <div
                    className="h-3 w-14 rounded-full"
                    style={{ backgroundColor: t.accent }}
                  />
                  <div
                    className="h-2 w-6 rounded-full opacity-60"
                    style={{ backgroundColor: t.text }}
                  />
                </div>

                {/* Card simulation */}
                <div
                  className="rounded-lg p-2 flex items-center justify-between shadow-xs"
                  style={{
                    backgroundColor: t.surface,
                    borderColor: t.border,
                    borderWidth: "1px",
                  }}
                >
                  <div className="space-y-1">
                    <div
                      className="h-2 w-16 rounded-sm"
                      style={{ backgroundColor: t.text }}
                    />
                    <div
                      className="h-1.5 w-10 rounded-sm opacity-50"
                      style={{ backgroundColor: t.text }}
                    />
                  </div>
                  <div
                    className="h-4 px-2 rounded-full text-[9px] font-medium flex items-center justify-center text-white"
                    style={{ backgroundColor: t.accent }}
                  >
                    Shot
                  </div>
                </div>
              </div>

              {/* Theme title and metadata */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-base text-ink group-hover:text-accent transition-colors">
                    {t.name}
                  </span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-accent/90 font-mono tracking-tight mt-0.5">
                  {t.palette}
                </p>
                <p className="text-xs text-ink-muted mt-1.5 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
