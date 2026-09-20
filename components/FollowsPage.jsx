"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, getAuthUser } from "../lib/supabaseClient";
import { formatExactLastSeen } from "./lastSeen";
import {
  ArrowLeft,
  Search,
  UserCheck,
  Users,
  UserPlus,
  User,
  ChevronDown,
  MoreHorizontal,
  Share2,
  MessageSquare,
  X,
} from "lucide-react";
import { useToast } from "./Toast";
import { useAuthDrawer } from "./AuthDrawer";
import AuthBarrier from "./AuthBarrier";
import { authFetch } from "../lib/apiClient";

// Pastel color palette for default avatars (matching screenshot: mint, lavender, pink, yellow)
const AVATAR_PALETTES = [
  { bg: "bg-[#E8F8EE]", text: "text-[#1E3A2F]" },
  { bg: "bg-[#F3E8FF]", text: "text-[#3B1E54]" },
  { bg: "bg-[#FCE7F3]", text: "text-[#541E3B]" },
  { bg: "bg-[#FEF3C7]", text: "text-[#54431E]" },
  { bg: "bg-[#E0F2FE]", text: "text-[#1E3A54]" },
  { bg: "bg-[#FEE2E2]", text: "text-[#541E1E]" },
];

export default function FollowsPage({ initialTab = "following" }) {
  const router = useRouter();
  const toast = useToast();
  const { openAuth } = useAuthDrawer();

  const [activeTab, setActiveTab] = useState(initialTab); // "following" | "followers"
  const [currentUser, setCurrentUser] = useState(null);
  const [targetUserId, setTargetUserId] = useState(null);
  const [followingList, setFollowingList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyUserIds, setBusyUserIds] = useState(new Set());
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [activeMoreMenuId, setActiveMoreMenuId] = useState(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".dropdown-container")) {
        setActiveDropdownId(null);
        setActiveMoreMenuId(null);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Inspect URL query params for ?user=xxx
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setTargetUserId(sp.get("user") || null);
  }, []);

  // Load follows data
  const loadData = async (uid, targetId) => {
    const queryUid = targetId || uid;
    if (!queryUid) {
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch(`/api/follows?userId=${queryUid}&currentUserId=${uid || ""}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setFollowingList(json.following || []);
          setFollowersList(json.followers || []);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("API follows error, fallback to direct query:", e);
    }

    // Direct fallback
    try {
      const [followingRes, followersRes] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", queryUid),
        supabase.from("follows").select("follower_id").eq("following_id", queryUid),
      ]);

      const followingIds = (followingRes.data || [])
        .map((r) => r.following_id)
        .filter((id) => id !== queryUid);
      const followerIds = (followersRes.data || [])
        .map((r) => r.follower_id)
        .filter((id) => id !== queryUid);
      const allIds = Array.from(new Set([...followingIds, ...followerIds]));

      if (allIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("*").in("id", allIds);
        const profMap = {};
        (profs || []).forEach((p) => {
          profMap[p.id] = p;
        });

        setFollowingList(
          followingIds.map((id) => ({
            id,
            username: profMap[id]?.username || id.slice(0, 8),
            display_name: profMap[id]?.display_name || profMap[id]?.username || "Creative",
            bio: profMap[id]?.bio || "",
            avatar_url: profMap[id]?.avatar_url || null,
            last_active: profMap[id]?.last_active,
            shotsCount: 0,
            followersCount: 0,
            followingCount: 0,
            isFollowing: true,
          }))
        );

        setFollowersList(
          followerIds.map((id) => ({
            id,
            username: profMap[id]?.username || id.slice(0, 8),
            display_name: profMap[id]?.display_name || profMap[id]?.username || "Creative",
            bio: profMap[id]?.bio || "",
            avatar_url: profMap[id]?.avatar_url || null,
            last_active: profMap[id]?.last_active,
            shotsCount: 0,
            followersCount: 0,
            followingCount: 0,
            isFollowing: false,
          }))
        );
      }
    } catch (err) {
      console.error("Direct query follows error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial user fetch
  useEffect(() => {
    let ignore = false;
    async function init() {
      const u = await getAuthUser();
      if (!ignore) {
        setCurrentUser(u);
        if (u) {
          await loadData(u.id, targetUserId);
        } else {
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [targetUserId]);

  // Toggle follow / unfollow action
  const handleToggleFollow = async (targetUser) => {
    if (!currentUser) {
      openAuth("signin");
      return;
    }

    if (currentUser.id === targetUser.id) {
      toast.info("You cannot follow your own account.");
      return;
    }

    const isCurrentlyFollowing = targetUser.isFollowing;
    const action = isCurrentlyFollowing ? "unfollow" : "follow";

    setBusyUserIds((prev) => new Set(prev).add(targetUser.id));

    // Optimistic update
    const updateList = (list) =>
      list.map((u) => {
        if (u.id === targetUser.id) {
          return {
            ...u,
            isFollowing: !isCurrentlyFollowing,
            followersCount: isCurrentlyFollowing
              ? Math.max(0, (u.followersCount || 0) - 1)
              : (u.followersCount || 0) + 1,
          };
        }
        return u;
      });

    setFollowingList((prev) => {
      if (action === "unfollow" && (!targetUserId || targetUserId === currentUser.id)) {
        return prev.filter((u) => u.id !== targetUser.id);
      }
      return updateList(prev);
    });
    setFollowersList((prev) => updateList(prev));

    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerId: currentUser.id,
          followingId: targetUser.id,
          action,
        }),
      });

      if (!res.ok) throw new Error("Failed to update follow status");

      toast.success(
        action === "follow"
          ? `Now following @${targetUser.username}`
          : `Unfollowed @${targetUser.username}`
      );
    } catch (err) {
      toast.error("Action failed. Please try again.");
      if (currentUser) loadData(currentUser.id, targetUserId);
    } finally {
      setBusyUserIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
      setActiveDropdownId(null);
    }
  };

  // Switch tabs
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchQuery("");
    const newPath = newTab === "following" ? "/profile/following" : "/profile/followers";
    const query = targetUserId ? `?user=${targetUserId}` : "";
    window.history.pushState(null, "", `${newPath}${query}`);
  };

  // Filter current active list by search query and exclude self
  const rawList = activeTab === "following" ? followingList : followersList;

  const activeList = useMemo(() => {
    const selfId = targetUserId || currentUser?.id;
    return rawList.filter((u) => u.id !== selfId);
  }, [rawList, targetUserId, currentUser?.id]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return activeList;
    const q = searchQuery.toLowerCase().trim();
    return activeList.filter(
      (u) =>
        u.display_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.bio?.toLowerCase().includes(q)
    );
  }, [activeList, searchQuery]);

  // Copy profile link helper
  const handleCopyProfileLink = (username) => {
    const url = `${window.location.origin}/u/${username}`;
    navigator.clipboard?.writeText(url);
    toast.success("Profile link copied to clipboard!");
    setActiveMoreMenuId(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-3 border-black border-t-[#FFD21E] rounded-full animate-spin mb-4" />
        <p className="font-serif text-2xl text-ink font-normal">
          Loading {activeTab === "following" ? "following list" : "followers"}...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthBarrier
        title="Community Connections"
        subtitle="Sign in to view your followers, discover new curators, and follow creators on Shotzi."
        badge="MEMBERS ONLY • FOLLOWS"
        icon={<Users className="w-7 h-7 text-black stroke-[2.5]" />}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 space-y-10 font-sans">
      {/* 1. TOP HEADER & HERO SECTION (Exact matching reference layout with generous spacing) */}
      <div className="relative pt-2 pb-2">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-1">
          {/* Left: Back button + Title with yellow underline + Subtitle */}
          <div className="flex items-start gap-4 sm:gap-5">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-11 h-11 rounded-full border-2 border-black bg-white hover:bg-zinc-50 flex items-center justify-center text-black shadow-[2.5px_2.5px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all shrink-0 mt-1"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="space-y-1.5">
              {/* Title with yellow brush stroke highlighter underline effect */}
              <div className="relative inline-block">
                <h1 className="relative z-10 font-serif text-4xl sm:text-5xl lg:text-[52px] font-black text-black tracking-tight leading-tight">
                  {activeTab === "following" ? "Following" : "Followers"}
                </h1>
                <span className="absolute bottom-2 left-0 w-full h-3.5 bg-[#FFD21E] z-0 rounded-xs" />
              </div>

              <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                {activeTab === "following"
                  ? `Following ${followingList.length} ${
                      followingList.length === 1 ? "creative" : "creatives"
                    } on Shotzi`
                  : `${followersList.length} ${
                      followersList.length === 1 ? "creative follows" : "creatives follow"
                    } you on Shotzi`}
              </p>
            </div>
          </div>

          {/* Right Controls: Search bar + Toggle buttons + Camera Girl (all beautifully spaced and unobstructed) */}
          <div className="flex flex-wrap sm:flex-nowrap items-end gap-3.5 sm:gap-4 self-start lg:self-end">
            {/* Search bar */}
            <div className="relative w-full sm:w-56 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "following"
                    ? "Search people you follow..."
                    : "Search followers..."
                }
                className="w-full pl-10 pr-8 py-2.5 sm:py-3 rounded-full border-2 border-black bg-white text-xs font-semibold text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/10 shadow-[3px_3px_0px_#18181B] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Toggle buttons: Following vs Followers with proper shadows, padding, and spacing */}
            <div className="inline-flex items-center gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleTabChange("following")}
                className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-bold border-2 border-black whitespace-nowrap shrink-0 transition-all ${
                  activeTab === "following"
                    ? "bg-[#FFD21E] text-black shadow-[3.5px_3.5px_0px_#18181B] hover:shadow-[4.5px_4.5px_0px_#18181B] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1.5px_1.5px_0px_#18181B]"
                    : "bg-white text-zinc-800 hover:bg-zinc-50 shadow-[3px_3px_0px_#18181B] hover:shadow-[4px_4px_0px_#18181B] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1.5px_1.5px_0px_#18181B]"
                }`}
              >
                <UserCheck className="w-4 h-4 stroke-[2.5]" />
                <span>Following</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("followers")}
                className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-bold border-2 border-black whitespace-nowrap shrink-0 transition-all ${
                  activeTab === "followers"
                    ? "bg-[#FFD21E] text-black shadow-[3.5px_3.5px_0px_#18181B] hover:shadow-[4.5px_4.5px_0px_#18181B] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1.5px_1.5px_0px_#18181B]"
                    : "bg-white text-zinc-800 hover:bg-zinc-50 shadow-[3px_3px_0px_#18181B] hover:shadow-[4px_4px_0px_#18181B] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1.5px_1.5px_0px_#18181B]"
                }`}
              >
                <Users className="w-4 h-4 stroke-[2.5]" />
                <span>Followers</span>
              </button>
            </div>

            {/* Camera Girl Illustration: completely visible to the right of buttons, aiming camera left */}
            <div className="hidden sm:block shrink-0 w-28 sm:w-32 md:w-36 pointer-events-none select-none -mb-1.5 ml-1">
              <img
                src="/decor/camera_girl_only.png"
                alt="Camera girl"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. CREATORS CARD GRID (Exact 4-Column Neo-Brutalist Cards matching reference) */}
      {filteredList.length === 0 ? (
        <div className="max-w-md mx-auto py-16 text-center space-y-3 bg-white border-2 border-black rounded-3xl p-8 shadow-[4px_4px_0px_#18181B]">
          <div className="w-14 h-14 rounded-2xl bg-[#FFD21E] border-2 border-black text-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#18181B]">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-2xl text-ink font-bold">
            {searchQuery
              ? "No creatives match your search"
              : activeTab === "following"
              ? "Not following anyone yet"
              : "No followers yet"}
          </h2>
          <p className="text-xs text-zinc-600 leading-relaxed max-w-xs mx-auto">
            {searchQuery
              ? "Try searching for another username or display name."
              : activeTab === "following"
              ? "Explore the feed, discover aesthetic camera rolls, and follow creators you love."
              : "Share quiet moments and your circle will naturally grow."}
          </p>
          <Link
            href="/"
            className="neo-btn neo-btn-yellow inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold mt-2"
          >
            <span>Explore Feed</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {filteredList.map((creative, index) => {
            const palette = AVATAR_PALETTES[index % AVATAR_PALETTES.length];
            const initial = (creative.display_name || creative.username || "C")
              .charAt(0)
              .toUpperCase();
            const lastSeenInfo = formatExactLastSeen(creative.last_active);
            const isBusy = busyUserIds.has(creative.id);
            const isMenuOpen = activeMoreMenuId === creative.id;
            const isDropdownOpen = activeDropdownId === creative.id;

            return (
              <div
                key={creative.id}
                className="group bg-white rounded-3xl border-2 border-black shadow-[4px_4px_0px_#18181B] hover:shadow-[6px_6px_0px_#18181B] hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Top Cover Banner */}
                  <div className="h-36 sm:h-40 w-full relative overflow-hidden border-b-2 border-black bg-zinc-100">
                    <img
                      src={creative.coverImage}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Options '...' Button in top right */}
                    <div className="absolute top-2.5 right-2.5 dropdown-container">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMoreMenuId(isMenuOpen ? null : creative.id);
                          setActiveDropdownId(null);
                        }}
                        className="w-7.5 h-7.5 rounded-full bg-white/95 backdrop-blur-xs border-2 border-black shadow-[1.5px_1.5px_0px_#18181B] flex items-center justify-center text-black hover:bg-zinc-50 active:scale-95 transition-all"
                        title="Options"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-9 w-44 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#18181B] py-1.5 z-30 space-y-0.5 animate-in fade-in zoom-in-95">
                          <Link
                            href={`/u/${creative.username}`}
                            className="w-full px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 flex items-center gap-2"
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>View Profile</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleCopyProfileLink(creative.username)}
                            className="w-full text-left px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 flex items-center gap-2"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </button>
                          <Link
                            href={`/chat?user=${creative.id}`}
                            className="w-full px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 flex items-center gap-2"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Send Message</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Overlapping Large Avatar Circle */}
                  <div className="px-5 -mt-10 relative z-10 flex items-end justify-between">
                    <Link
                      href={`/u/${creative.username}`}
                      className="block shrink-0 focus:outline-none"
                    >
                      <div
                        className={`w-18 h-18 sm:w-20 sm:h-20 rounded-full border-3 border-black shadow-[3px_3px_0px_#18181B] overflow-hidden flex items-center justify-center font-bold text-2xl group-hover:scale-105 transition-transform duration-200 ${
                          palette.bg
                        } ${palette.text}`}
                      >
                        {creative.avatar_url ? (
                          <img
                            src={creative.avatar_url}
                            alt={creative.display_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{initial}</span>
                        )}
                      </div>
                    </Link>
                  </div>

                  {/* Creator Info: Name, Handle, Online Status, Bio */}
                  <div className="px-5 pt-2.5 pb-2 space-y-1">
                    <Link
                      href={`/u/${creative.username}`}
                      className="font-black text-base sm:text-lg text-black hover:underline truncate block leading-tight tracking-tight"
                    >
                      {creative.display_name}
                    </Link>

                    <Link
                      href={`/u/${creative.username}`}
                      className="text-xs text-zinc-500 font-mono block hover:text-black transition-colors truncate"
                    >
                      @{creative.username}
                    </Link>

                    {/* Online / Offline status with indicator dot */}
                    <div className="flex items-center gap-1.5 text-[11px] font-medium pt-0.5">
                      {lastSeenInfo.isOnline ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-emerald-700 font-semibold">Online</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full border-1.5 border-zinc-400 shrink-0" />
                          <span className="text-zinc-500">{lastSeenInfo.text}</span>
                        </>
                      )}
                    </div>

                    {/* Bio snippet */}
                    <p className="text-xs text-zinc-600 line-clamp-2 pt-1 leading-relaxed min-h-[34px]">
                      {creative.bio || "Capturing moments and quiet details."}
                    </p>
                  </div>
                </div>

                {/* Bottom Section: Stats Row & Action Buttons */}
                <div className="px-5 pb-5 pt-2 space-y-3.5">
                  {/* Stats Row (Shots | Followers | Following) */}
                  <div className="grid grid-cols-3 py-2 border-t border-b border-black/10 text-center">
                    <div>
                      <span className="font-black text-sm text-black block leading-tight">
                        {creative.shotsCount || 0}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        Shots
                      </span>
                    </div>

                    <div className="border-l border-r border-black/10">
                      <span className="font-black text-sm text-black block leading-tight">
                        {creative.followersCount || 0}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        Followers
                      </span>
                    </div>

                    <div>
                      <span className="font-black text-sm text-black block leading-tight">
                        {creative.followingCount || 0}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        Following
                      </span>
                    </div>
                  </div>

                  {/* Actions Row (Following ▾ button + Profile icon button) */}
                  <div className="flex items-center gap-2">
                    {/* Primary Button: Following ▾ (or Follow if not following, or Your Profile if self) */}
                    <div className="relative flex-1 dropdown-container">
                      {currentUser && creative.id === currentUser.id ? (
                        <Link
                          href="/profile"
                          className="w-full py-2 px-3 rounded-full border-2 border-black bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700 shadow-[2px_2px_0px_#18181B] flex items-center justify-center gap-1.5 transition-all"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Your Profile</span>
                        </Link>
                      ) : creative.isFollowing ? (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              setActiveDropdownId(isDropdownOpen ? null : creative.id)
                            }
                            className="w-full py-2 px-3 rounded-full border-2 border-black bg-white hover:bg-zinc-50 text-xs font-bold text-black shadow-[2px_2px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
                          >
                            <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Following</span>
                            <ChevronDown className="w-3 h-3 text-zinc-500" />
                          </button>

                          {/* Dropdown for Unfollow */}
                          {isDropdownOpen && (
                            <div className="absolute left-0 bottom-11 w-full bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#18181B] p-1.5 z-30 animate-in fade-in zoom-in-95">
                              <button
                                type="button"
                                onClick={() => handleToggleFollow(creative)}
                                className="w-full text-left px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-1.5 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Unfollow</span>
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleFollow(creative)}
                          className="w-full py-2 px-3 rounded-full border-2 border-black bg-[#FFD21E] hover:bg-[#FFE066] text-xs font-black text-black shadow-[2px_2px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
                        >
                          <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{activeTab === "followers" ? "Follow Back" : "Follow"}</span>
                        </button>
                      )}
                    </div>

                    {/* Secondary Button: User Profile / Direct Message */}
                    <Link
                      href={`/u/${creative.username}`}
                      className="w-9 h-9 rounded-full border-2 border-black bg-white hover:bg-zinc-50 flex items-center justify-center text-black shadow-[2px_2px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all shrink-0"
                      title="View Profile"
                    >
                      <User className="w-4 h-4 stroke-[2.2]" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
