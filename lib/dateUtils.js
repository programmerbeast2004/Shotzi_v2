/**
 * Safely parse any date string or timestamp from database (PostgreSQL/Supabase).
 * When Supabase returns timestamps without timezone (e.g. '2026-09-19T09:30:25.672228'),
 * JavaScript Date constructor treats it as local time instead of UTC, causing huge timezone drift.
 * This helper ensures UTC timestamps are parsed as UTC so they display in the user's exact local time.
 */
export function parseSafeDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === "number") return new Date(val);

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return new Date();
    // Numeric timestamp string
    if (/^\d+$/.test(s)) return new Date(Number(s));

    // Convert SQL space separated date to ISO 'T'
    let iso = s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s;

    // If there is no timezone offset or 'Z' at the end, append 'Z' because DB stores UTC
    if (!iso.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(iso)) {
      iso += "Z";
    }

    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date(val) : d;
  }

  return new Date(val);
}

/**
 * Format chat message time in the user's local timezone (e.g. "3:00 PM")
 */
export function formatMessageTime(val) {
  try {
    const d = parseSafeDate(val);
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/**
 * Format chat message group date (e.g. "Sep 19, 2026")
 */
export function formatMessageDate(val) {
  try {
    const d = parseSafeDate(val);
    return d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Format relative conversation preview time (e.g. "just now", "5m", "2h", "3d", "1w")
 */
export function formatRelativeTime(val) {
  if (!val) return "";
  try {
    const d = parseSafeDate(val);
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - d.getTime()) / 1000));

    if (diffSec < 45) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
    return `${Math.floor(diffSec / 604800)}w`;
  } catch {
    return "";
  }
}
