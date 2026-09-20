"use client";

import { formatLastSeen } from "./lastSeen";
import { ArrowRight, X, User } from "lucide-react";

export default function FollowerCard({
  profile,
  onAction,
  actionTitle,
  actionDisabled,
  onVisit,
}) {
  const username = profile.username || profile.id?.slice(0, 8);
  const displayName = profile.display_name || username || "User";

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 hover:border-border-hover transition-all duration-200 hover:shadow-md flex flex-col justify-between h-full group">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between mb-3.5">
          {/* Avatar */}
          <div className="relative cursor-pointer" onClick={onVisit}>
            <div className="w-13 h-13 rounded-2xl bg-surface-soft border border-border flex items-center justify-center font-serif text-lg font-bold text-accent overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {profile.last_active && (() => {
              const s = formatLastSeen(profile.last_active);
              if (s?.type === "online") {
                return (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success rounded-full border-2 border-surface" />
                );
              }
              return null;
            })()}
          </div>

          {/* Action Button (Remove / Unfollow) */}
          {onAction && (
            <button
              onClick={onAction}
              disabled={actionDisabled}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-lg active:scale-95 disabled:opacity-50"
              title={actionTitle}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Profile Info */}
        <div className="mb-4 cursor-pointer" onClick={onVisit}>
          <h3 className="font-serif text-lg font-normal text-ink truncate group-hover:text-accent transition-colors">
            {displayName}
          </h3>
          <p className="text-xs text-ink-secondary font-mono tracking-tight truncate">
            @{username}
          </p>

          {profile.last_active && (() => {
            const s = formatLastSeen(profile.last_active);
            if (!s) return null;
            return (
              <p className="text-[11px] text-ink-muted mt-1">
                {s.text}
              </p>
            );
          })()}

          {profile.bio && (
            <p className="text-xs text-ink-secondary mt-2 line-clamp-2 leading-relaxed">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onVisit}
        className="w-full py-2 px-4 rounded-full border border-border bg-surface-soft hover:bg-surface text-xs font-medium text-ink transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 group-hover:border-accent/40"
      >
        <span>View Profile</span>
        <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}
