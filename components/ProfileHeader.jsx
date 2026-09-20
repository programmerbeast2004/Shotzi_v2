"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatLastSeen } from "./lastSeen";
import {
  UserPlus,
  Check,
  MessageSquare,
  Edit3,
  Trash2,
  Camera,
  Users,
  Zap,
  Shield,
} from "lucide-react";

export default function ProfileHeader({
  profile,
  isOwn,
  onEditClick,
  onDeleteClick,
  isFollowing,
  followerCount = 0,
  followingCount = 0,
  postsCount = 0,
  onFollow,
  currentUser,
  isAdminUser,
}) {
  const router = useRouter();
  const bannerUrl = profile?.header_image_url;
  const username = profile?.username || profile?.id?.slice(0, 8) || "user";
  const displayName = profile?.display_name || username;

  return (
    <section className="bg-white border-[3px] border-black rounded-3xl overflow-hidden shadow-[6px_6px_0px_#18181B] mb-8 relative transition-all duration-200">
      {/* Header Banner */}
      <div className="h-36 sm:h-48 md:h-56 w-full relative bg-zinc-100 overflow-hidden border-b-[3px] border-black">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt="Profile banner"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-amber-100 via-rose-100 to-teal-100 flex items-center justify-center text-zinc-400 font-black text-2xl sm:text-3xl select-none tracking-widest uppercase">
            Shotzi Camera Roll
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />

        {/* Vintage Film Badge / Sticker */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 bg-white/95 backdrop-blur-md border-2 border-black rounded-full px-3 py-1 shadow-[2px_2px_0px_#000] flex items-center gap-1.5 select-none pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-[#2ED197] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider text-black">
            Roll 35mm
          </span>
        </div>
      </div>

      {/* Main Profile Info */}
      <div className="px-4 sm:px-8 pb-6 relative space-y-4">
        {/* Top Info Row: Avatar overlapping banner + Clean text below banner + Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          {/* Avatar and Identifiers */}
          <div className="flex items-start sm:items-end gap-3.5 sm:gap-5">
            {/* Avatar (Alone overlaps banner with negative margin) */}
            <div className="-mt-12 sm:-mt-16 h-20 w-20 sm:h-28 sm:w-28 rounded-2xl bg-white border-[3px] border-black shadow-[4px_4px_0px_#18181B] flex items-center justify-center text-2xl sm:text-4xl font-black text-black shrink-0 overflow-hidden hover:-rotate-2 transition-transform duration-200">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>

            {/* Name & Identifiers (Cleanly in white area, never overlapping banner) */}
            <div className="pt-2 sm:pt-0 space-y-1 min-w-0 sm:pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-black text-black tracking-tight break-words">
                  {displayName}
                </h1>
                {isAdminUser && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-white bg-[#FF5376] border-2 border-black px-2 sm:px-2.5 py-0.5 rounded-full shadow-[1.5px_1.5px_0px_#000]">
                    👑 Master Admin
                  </span>
                )}
                {profile?.last_active && (() => {
                  const s = formatLastSeen(profile.last_active);
                  if (!s) return null;
                  if (s.type === "online") {
                    return (
                      <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-black bg-[#2ED197] border-2 border-black px-2 sm:px-2.5 py-0.5 rounded-full shadow-[1.5px_1.5px_0px_#000]">
                        <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                        online
                      </span>
                    );
                  }
                  return (
                    <span className="text-[10px] sm:text-[11px] font-bold text-zinc-600 bg-zinc-100 border border-black/30 px-2 py-0.5 rounded-full">
                      {s.text}
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs sm:text-sm font-mono text-zinc-500 font-bold">
                @{username}
              </p>
            </div>
          </div>

          {/* Action buttons (OG Funky Action Deck) */}
          <div className="flex items-center gap-2 sm:self-end pt-1 sm:pt-0 flex-wrap">
            {isOwn ? (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Admin Command Center Shortcut */}
                {isAdminUser && (
                  <Link
                    href="/admin"
                    title="Open Command Center"
                    className="group relative inline-flex items-center h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-black bg-[#FF5376] hover:bg-[#FF3E65] text-white shadow-[2px_2px_0px_#18181B] sm:shadow-[3px_3px_0px_#18181B] hover:shadow-[4px_4px_0px_#18181B] hover:-rotate-1 active:translate-x-0.5 active:translate-y-0.5 transition-all duration-300 ease-out cursor-pointer overflow-hidden shrink-0"
                  >
                    <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-white stroke-[2.5] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
                    <span className="text-[11px] sm:text-xs font-black text-white ml-1.5 whitespace-nowrap">
                      Command Center
                    </span>
                  </Link>
                )}

                {/* Funky Edit Profile Button */}
                <button
                  type="button"
                  onClick={onEditClick}
                  title="Edit Profile"
                  aria-label="Edit Profile"
                  className="group relative inline-flex items-center h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-black bg-[#FFD21E] hover:bg-[#FFDE59] text-black shadow-[2px_2px_0px_#18181B] sm:shadow-[3px_3px_0px_#18181B] hover:shadow-[4px_4px_0px_#18181B] hover:-rotate-1 active:translate-x-0.5 active:translate-y-0.5 transition-all duration-300 ease-out cursor-pointer overflow-hidden shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-black stroke-[2.5] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
                  <span className="max-w-0 opacity-0 whitespace-nowrap overflow-hidden transition-all duration-300 ease-out group-hover:max-w-40 group-hover:opacity-100 group-hover:pl-2 group-hover:pr-1 text-xs font-black text-black tracking-tight select-none">
                    <span className="inline-block transform transition-transform duration-300 ease-out -translate-x-2 group-hover:translate-x-0">
                      Edit Profile
                    </span>
                  </span>
                </button>

                {/* Funky Delete Account Button */}
                <button
                  type="button"
                  onClick={onDeleteClick}
                  title="Delete Account"
                  aria-label="Delete Account"
                  className="group relative inline-flex items-center h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-black bg-[#FFF0F2] hover:bg-[#FFE2E6] text-[#E11D48] shadow-[2px_2px_0px_#18181B] sm:shadow-[3px_3px_0px_#18181B] hover:shadow-[4px_4px_0px_#18181B] hover:rotate-1 active:translate-x-0.5 active:translate-y-0.5 transition-all duration-300 ease-out cursor-pointer overflow-hidden shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-[#E11D48] stroke-[2.5] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
                  <span className="max-w-0 opacity-0 whitespace-nowrap overflow-hidden transition-all duration-300 ease-out group-hover:max-w-40 group-hover:opacity-100 group-hover:pl-2 group-hover:pr-1 text-xs font-black text-[#E11D48] tracking-tight select-none">
                    <span className="inline-block transform transition-transform duration-300 ease-out -translate-x-2 group-hover:translate-x-0">
                      Delete Account
                    </span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onFollow}
                  className={`neo-btn px-4 sm:px-5 py-1.5 sm:py-2 text-xs font-black transition-all ${
                    isFollowing
                      ? "neo-btn-white"
                      : "neo-btn-yellow shadow-[2.5px_2.5px_0px_#18181B]"
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Follow</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/chat?user=${profile?.id}`)}
                  className="neo-btn neo-btn-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold"
                  title="Message Curator"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Message</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bio (Funky candid diary quote card) */}
        {profile?.bio && (
          <div className="inline-flex items-center gap-2.5 bg-[#FAFAFA] border-2 border-black/15 rounded-2xl px-3.5 py-2 shadow-xs max-w-2xl">
            <span className="text-base select-none">💭</span>
            <p className="text-xs sm:text-sm text-zinc-800 font-bold leading-relaxed whitespace-pre-line break-words">
              {profile.bio}
            </p>
          </div>
        )}

        {/* Stats strip with Responsive Neo-Sticker Pills */}
        <div className="pt-3 border-t-2 border-black/10 text-xs">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 w-full sm:w-auto sm:flex sm:items-center">
            <div
              onClick={() => router.push(`/profile/followers?user=${profile.id}`)}
              className="cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-0.5 sm:gap-2 px-1.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-black bg-white shadow-[2px_2px_0px_#18181B] hover:shadow-[3px_3px_0px_#18181B] hover:bg-[#FFD21E] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center sm:text-left min-w-0"
            >
              <Users className="w-3.5 h-3.5 text-zinc-600 hidden sm:block shrink-0" />
              <span className="font-black text-xs sm:text-sm text-black truncate">
                {followerCount || 0}
              </span>
              <span className="font-bold text-[10px] sm:text-xs text-zinc-600 truncate">followers</span>
            </div>

            <div
              onClick={() => router.push(`/profile/following?user=${profile.id}`)}
              className="cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-0.5 sm:gap-2 px-1.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-black bg-white shadow-[2px_2px_0px_#18181B] hover:shadow-[3px_3px_0px_#18181B] hover:bg-[#2ED197] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center sm:text-left min-w-0"
            >
              <Zap className="w-3.5 h-3.5 text-zinc-600 hidden sm:block shrink-0" />
              <span className="font-black text-xs sm:text-sm text-black truncate">
                {followingCount || 0}
              </span>
              <span className="font-bold text-[10px] sm:text-xs text-zinc-600 truncate">following</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-0.5 sm:gap-2 px-1.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-black bg-white shadow-[2px_2px_0px_#18181B] text-center sm:text-left min-w-0">
              <Camera className="w-3.5 h-3.5 text-zinc-600 hidden sm:block shrink-0" />
              <span className="font-black text-xs sm:text-sm text-black truncate">
                {postsCount || 0}
              </span>
              <span className="font-bold text-[10px] sm:text-xs text-zinc-600 truncate">shots</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
