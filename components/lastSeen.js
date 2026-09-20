import { parseSafeDate } from "../lib/dateUtils";

export function formatExactLastSeen(lastActive, isLivePresence = false) {
  // If actively in chat right now via live presence
  if (isLivePresence) {
    return {
      text: "Online",
      isOnline: true,
      color: "emerald",
    };
  }

  if (!lastActive) {
    return {
      text: "Offline",
      isOnline: false,
      color: "zinc",
    };
  }

  const date = parseSafeDate(lastActive);
  if (isNaN(date.getTime())) {
    return { text: "Offline", isOnline: false, color: "zinc" };
  }

  const now = Date.now();
  const diffMs = now - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  // Active within last 2 minutes -> Online
  if (diffMs <= 2 * minute) {
    return {
      text: "Online",
      isOnline: true,
      color: "emerald",
    };
  }

  // Offline with relative duration
  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute));
    return {
      text: `Offline · ${mins}m ago`,
      isOnline: false,
      color: "zinc",
    };
  }

  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return {
      text: `Offline · ${hours}h ago`,
      isOnline: false,
      color: "zinc",
    };
  }

  if (diffMs < 2 * day) {
    return {
      text: "Offline · yesterday",
      isOnline: false,
      color: "zinc",
    };
  }

  const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return {
    text: `Offline · ${dateStr}`,
    isOnline: false,
    color: "zinc",
  };
}

export function formatLastChatted(dateInput) {
  if (!dateInput) {
    return "Never chatted yet";
  }

  const date = parseSafeDate(dateInput);
  if (isNaN(date.getTime())) {
    return "Never chatted yet";
  }

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  }

  const isCurrentYear = date.getFullYear() === now.getFullYear();
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });

  return `${dateStr} at ${timeStr}`;
}

export function formatLastSeen(lastActive) {
  return formatExactLastSeen(lastActive);
}

export function isOnline(lastActive) {
  if (!lastActive) return false;
  const t = parseSafeDate(lastActive);
  if (isNaN(t.getTime())) return false;
  return Date.now() - t.getTime() <= 2 * 60 * 1000;
}
