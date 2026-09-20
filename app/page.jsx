"use client";

import {
  ArrowRight,
  Camera,
  Compass,
  Globe,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthDrawer } from "../components/AuthDrawer";
import PostGrid from "../components/PostGrid";
import SkeletonCard from "../components/SkeletonCard";
import { useToast } from "../components/Toast";
import { isAdmin } from "../lib/admin";
import { executeAdminDelete } from "../lib/adminService";
import { scrollToCurrentHash } from "../lib/scrollToSection";
import { getAuthUser, supabase } from "../lib/supabaseClient";

export default function HomePage() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState([]);
  const [likeCountMap, setLikeCountMap] = useState({});
  const [commentCountMap, setCommentCountMap] = useState({});
  const [livePresenceUserIds, setLivePresenceUserIds] = useState(new Set());
  const [dashboardTab, setDashboardTab] = useState("all");
  const toast = useToast();
  const { openAuth } = useAuthDrawer();

  const onDeletePost = async (postId) => {
    const postToDelete = posts.find((p) => p.id === postId);
    const isOwner = user && postToDelete && user.id === postToDelete.user_id;
    const confirmMsg = isOwner
      ? "Are you sure you want to delete this shot?"
      : "Admin action: Permanently remove this shot from the community database?";
    if (!window.confirm(confirmMsg)) return;
    try {
      if (isAdmin(user)) {
        const res = await executeAdminDelete("delete_post", { postId });
        if (!res.success) throw new Error(res.error || "Failed to delete post.");
      } else {
        await supabase.from("likes").delete().eq("post_id", postId);
        await supabase.from("comments").delete().eq("post_id", postId);
        const { error } = await supabase.from("posts").delete().eq("id", postId);
        if (error) throw error;
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Shot deleted successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete shot: " + (error.message || error));
    }
  };

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);

      const u = await getAuthUser();
      if (ignore) return;
      setUser(u);

      if (!u) {
        setLoading(false);
        return;
      }

      // Fire profile query and posts query in PARALLEL
      const [profileRes, postsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(40),
      ]);

      if (ignore) return;
      if (profileRes.data) setProfile(profileRes.data);

      const postsData = postsRes.data || [];
      const userIds = Array.from(new Set(postsData.map((p) => p.user_id).filter(Boolean)));
      const postIds = postsData.map((p) => p.id);

      // Fire profiles, likes, and comments queries in PARALLEL
      const [profilesRes, likesRes, commentsRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, username, avatar_url, last_active").in("id", userIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from("likes").select("post_id, user_id").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from("comments").select("post_id").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (ignore) return;

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));
      const formattedPosts = postsData.map((p) => {
        const prof = profileMap.get(p.user_id);
        return {
          ...p,
          profile_username: prof?.username || p.user_email?.split("@")[0] || "user",
          profile_avatar_url: prof?.avatar_url || null,
          profile_last_active: prof?.last_active || null,
        };
      });

      const likeCounts = {};
      const likedByUser = [];
      (likesRes.data || []).forEach((row) => {
        likeCounts[row.post_id] = (likeCounts[row.post_id] || 0) + 1;
        if (row.user_id === u.id) likedByUser.push(row.post_id);
      });

      const commentCounts = {};
      (commentsRes.data || []).forEach((row) => {
        commentCounts[row.post_id] = (commentCounts[row.post_id] || 0) + 1;
      });

      setPosts(formattedPosts);
      setLikeCountMap(likeCounts);
      setCommentCountMap(commentCounts);
      setLikedPostIds(likedByUser);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("realtime:posts-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        const newPost = payload.new;
        setPosts((current) => [
          { ...newPost, profile_username: newPost.profile_username || newPost.user_email?.split("@")[0] || "user" },
          ...current,
        ]);
      })
      .subscribe();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: userProf } = await supabase.from("profiles").select("*").eq("id", u.id).single();
        if (userProf) setProfile(userProf);
      } else {
        setProfile(null);
        setPosts([]);
      }
    });

    const presenceKey = `client-${Math.random().toString(36).slice(2, 8)}`;
    const presenceChannel = supabase.channel("shotzi-live-presence", { config: { presence: { key: presenceKey } } });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const ids = new Set();
        Object.values(state).forEach((presences) => {
          (presences || []).forEach((p) => { if (p.user_id) ids.add(p.user_id); });
        });
        setLivePresenceUserIds(ids);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setLivePresenceUserIds((prev) => {
          const next = new Set(prev);
          (newPresences || []).forEach((p) => { if (p.user_id) next.add(p.user_id); });
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setLivePresenceUserIds((prev) => {
          const next = new Set(prev);
          (leftPresences || []).forEach((p) => { if (p.user_id) next.delete(p.user_id); });
          return next;
        });
      })
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
      authSub?.unsubscribe();
    };
  }, []);

  // Handle hash-anchor scrolling after auth resolves AND on same-page hashchange.
  // Delegates all the hard work (navbar offset, retry, layout-correction) to
  // the shared scrollToSection utility.
  useEffect(() => {
    if (!loading) scrollToCurrentHash();

    const onHashChange = () => scrollToCurrentHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [loading]);

  const filteredPosts = useMemo(() => {
    if (dashboardTab === "mine" && user) return posts.filter((p) => p.user_id === user.id);
    if (dashboardTab === "popular") return [...posts].sort((a, b) => (likeCountMap[b.id] || 0) - (likeCountMap[a.id] || 0));
    return posts;
  }, [posts, dashboardTab, user, likeCountMap]);

  const userShotsCount = useMemo(() => {
    if (!user) return 0;
    return posts.filter((p) => p.user_id === user.id).length;
  }, [posts, user]);

  const userReceivedLikesCount = useMemo(() => {
    if (!user) return 0;
    const myPostIds = new Set(posts.filter((p) => p.user_id === user.id).map((p) => p.id));
    return Object.entries(likeCountMap).reduce((acc, [postId, count]) => myPostIds.has(postId) ? acc + count : acc, 0);
  }, [posts, user, likeCountMap]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-8 sm:space-y-12 py-6">
        <div className="h-40 rounded-3xl border-2 border-black/10 bg-white/60 animate-pulse p-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. AUTHENTICATED — DASHBOARD + FEED (data only shown here)
  // =========================================================================
  if (user) {
    const displayName = profile?.display_name || profile?.username || user.email?.split("@")[0] || "Friend";
    const username = profile?.username || user.email?.split("@")[0] || "user";

    return (
      <div className="space-y-8 sm:space-y-10 pb-12">
        {/* Welcome card */}
        <section id="dashboard" className="relative overflow-hidden rounded-3xl border-2 border-black bg-white p-5 sm:p-7 shadow-[4.5px_4.5px_0px_#18181B] scroll-mt-24">
          <div className="absolute top-3 right-4 flex items-center gap-1.5 opacity-60">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFD21E] border border-black" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5376] border border-black" />
            <span className="w-2.5 h-2.5 rounded-full bg-black border border-black" />
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-black overflow-hidden bg-[#FFD21E] shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center font-black text-xl text-black">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#22C55E] border-2 border-white shadow-xs" title="Online now" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#18181B] tracking-tight leading-tight">Welcome back, {displayName}</h1>
                  <span className="px-2 py-0.5 rounded-full bg-[#FFD21E] text-black text-[10px] sm:text-[11px] font-black border border-black shadow-[1px_1px_0px_#000]">DASHBOARD</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 font-medium truncate">@{username} • Your soft place for loud feelings</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-nowrap sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <Link href="/upload" prefetch className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#FFD21E] text-black font-black text-xs sm:text-sm border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 transition-all text-center whitespace-nowrap shrink-0">
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3] shrink-0" /><span className="whitespace-nowrap leading-none">Dump a shot</span>
              </Link>
              <Link href="/reels" prefetch className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-white text-black font-bold text-xs sm:text-sm border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-zinc-50 hover:-translate-y-0.5 transition-all text-center whitespace-nowrap shrink-0">
                <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" /><span className="whitespace-nowrap leading-none">Infinite</span>
              </Link>
              <Link href="/chat" prefetch className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-white text-black font-bold text-xs sm:text-sm border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-zinc-50 hover:-translate-y-0.5 transition-all text-center whitespace-nowrap shrink-0">
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2] shrink-0" /><span className="whitespace-nowrap leading-none">Messages</span>
              </Link>
              <Link href="/chat/global" prefetch className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-white text-black font-bold text-xs sm:text-sm border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-zinc-50 hover:-translate-y-0.5 transition-all text-center whitespace-nowrap shrink-0">
                <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2] shrink-0" /><span className="whitespace-nowrap leading-none">Global</span>
              </Link>
            </div>
          </div>
          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-5 pt-4 border-t-2 border-black/10">
            {[
              { icon: <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />, bg: "bg-[#FFD21E]", label: "Your Shots", val: userShotsCount },
              { icon: <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-white" />, bg: "bg-[#FF5376]", label: "Likes Earned", val: userReceivedLikesCount },
              { icon: <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />, bg: "bg-white border border-black", label: "Total Moments", val: posts.length },
              { icon: <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#22C55E] animate-pulse" />, bg: "bg-[#22C55E]/20 border border-[#22C55E]", label: "Online Now", val: `${Math.max(1, livePresenceUserIds.size)} active` },
            ].map((s) => (
              <div key={s.label} className="p-2 sm:p-3 rounded-2xl bg-[#FFFDF0] border border-black/15 flex items-center gap-2 sm:gap-3 shadow-xs">
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>{s.icon}</div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{s.label}</p>
                  <p className="text-sm sm:text-lg font-black text-[#18181B]">{s.val}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Community Gallery */}
        <section id="feed" className="space-y-6 scroll-mt-24">
          <div id="moments" className="scroll-mt-24" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">Community Gallery</h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFD21E] text-black text-xs font-black border border-black">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />LIVE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 font-medium mt-0.5">Curated glimpses into skies, quiet corners, and fleeting feelings.</p>
            </div>
            <div className="inline-flex items-center p-1 rounded-full border-2 border-black bg-white shadow-[2px_2px_0px_#000] self-start sm:self-auto">
              {[["all", `All Shots (${posts.length})`], ["mine", `My Shots (${userShotsCount})`], ["popular", "Most Loved"]].map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => setDashboardTab(tab)} className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${dashboardTab === tab ? "bg-[#FFD21E] text-black border border-black shadow-[1px_1px_0px_#000]" : "text-zinc-600 hover:text-black"}`}>{label}</button>
              ))}
            </div>
          </div>
          {filteredPosts.length === 0 ? (
            <div className="max-w-md mx-auto py-12 text-center">
              <div className="rounded-3xl border-2 border-black bg-white p-8 shadow-[6px_6px_0px_#18181B] space-y-4">
                <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-black mb-3">
                  <img src="/illustrations/giraffe_scooter.jpg" alt="Giraffe on scooter" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-3xl font-black text-[#18181B]">{dashboardTab === "mine" ? "No shots dumped yet" : "Oh noo!"}</h3>
                <p className="text-xs text-zinc-600 font-medium">
                  {dashboardTab === "mine" ? "You haven't dumped any shots yet. Share your quiet chaos with the world!" : "You've caught us at a quiet time. Check back soon or dump the very first one!"}
                </p>
                <Link href="/upload" className="neo-btn neo-btn-yellow px-6 py-2.5 text-xs font-bold inline-flex items-center gap-2">
                  <Plus className="w-4 h-4 stroke-[3]" /><span>Dump a Shot</span>
                </Link>
              </div>
            </div>
          ) : (
            <PostGrid posts={filteredPosts} currentUser={user} likedPostIds={likedPostIds} likeCountMap={likeCountMap} commentCountMap={commentCountMap} onDeletePost={onDeletePost} livePresenceUserIds={livePresenceUserIds} />
          )}
        </section>
      </div>
    );
  }

  // =========================================================================
  // 2. UNAUTHENTICATED — FULL MARKETING LANDING PAGE (zero data exposed)
  // =========================================================================
  return (
    <div className="space-y-16 sm:space-y-24 pb-16">

      {/* HERO */}
      <section className="relative pt-4 pb-8 sm:pt-6 sm:pb-12 border-b-2 border-black/15">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black text-xs uppercase tracking-wider">
              <span>THE UNFILTERED SOCIAL SPACE</span>
              <span className="w-3 h-3 rounded-full bg-[#FFD21E] inline-block border border-black" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[76px] xl:text-[82px] font-black tracking-tight text-[#18181B] leading-[0.93]">
                A SOFT PLACE<br />
                <span className="inline-block relative my-1">
                  <span className="relative z-10 px-4 py-0.5 text-black">FOR LOUD</span>
                  <span className="absolute inset-0 bg-[#FFD21E] -rotate-1 -z-0 border-[2.5px] border-black rounded-2xl shadow-[4px_4px_0px_#000]" />
                  <svg className="absolute -top-3.5 -right-5 w-8 h-8 text-black pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                    <path d="M4 14L1 11" /><path d="M8 8L7 3" /><path d="M14 7L18 3" />
                  </svg>
                </span><br />
                FEELINGS<span className="inline-block w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#FF5376] ml-2 align-baseline border border-black/20" />
              </h1>
              <div className="flex items-center gap-3 pt-2">
                <div className="w-16 sm:w-24 h-[4px] bg-[#18181B] rounded-full" />
                <span className="font-serif italic text-2xl sm:text-3xl lg:text-[32px] text-zinc-900 font-normal">camera rolls, sunsets &amp; quiet chaos</span>
              </div>
            </div>
            <p className="text-base sm:text-lg text-zinc-700 max-w-xl leading-relaxed font-medium">
              Late-night streets, blurry sunsets, campus chaos, quiet rooms, and accidental beauty. A visual social space for the shots that made you feel something — raw, honest, and unposed.
            </p>
            <div className="flex items-center gap-4 flex-wrap pt-2">
              <button
                onClick={() => openAuth("signup")}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-[#FFD21E] text-black font-black text-base sm:text-lg border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <Sparkles className="w-5 h-5 text-black" />
                <span>Join Shotzi</span>
                <span>→</span>
              </button>
              <button
                onClick={() => openAuth("signin")}
                className="text-sm font-bold text-zinc-800 hover:text-black py-2 underline decoration-2 underline-offset-4"
              >
                Already have an account? Sign in
              </button>
            </div>
            <div className="flex items-center gap-6 pt-2 text-xs font-bold text-zinc-600">
              <span className="flex items-center gap-1.5">✅ 100% Free</span>
              <span className="flex items-center gap-1.5">✅ No algorithmic feed</span>
              <span className="flex items-center gap-1.5">✅ Real moments</span>
            </div>
          </div>
          <div className="lg:col-span-6 relative flex items-center justify-center w-full select-none pointer-events-none">
            <div className="relative w-full max-w-[560px] aspect-[855/700] sm:aspect-[855/650] flex items-center justify-center">
              <img src="/hero/hero_collage_full.png" alt="Shotzi Photo Dump Collage" className="w-full h-auto object-contain drop-shadow-sm" />
            </div>
          </div>
        </div>
      </section>

      {/* 4 POLAROIDS */}
      <section id="moments" className="space-y-8 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFD21E] text-black font-black text-xs uppercase tracking-wider border border-black shadow-[1.5px_1.5px_0px_#000]">
            SAME SKIES • DIFFERENT STORIES
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] tracking-tight">Dump what you felt today</h2>
          <p className="text-sm sm:text-base text-zinc-600 font-medium">From the little quiet coffee sips to boundless starry nights. Every moment finds a home here.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto pt-4">
          {[
            { src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80", label: "places", rotate: "-rotate-1" },
            { src: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop&q=80", label: "pets", rotate: "rotate-2" },
            { src: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80", label: "little things", rotate: "-rotate-2" },
            { src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80", label: "big feelings", rotate: "rotate-1" },
          ].map((p) => (
            <div key={p.label} className={`group relative bg-white p-3 sm:p-4 rounded-2xl border-2 border-black shadow-[4px_4px_0px_#18181B] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#18181B] ${p.rotate} transition-all`}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-4 bg-[#FFF9D2]/90 border border-black/20 rounded-xs -rotate-2 pointer-events-none shadow-xs z-10" />
              <div className="w-full aspect-square rounded-xl overflow-hidden border-2 border-black/80 bg-zinc-100 mb-3">
                <img src={p.src} alt={p.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="text-center font-serif italic text-base sm:text-lg font-bold text-zinc-900">{p.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT + HOW IT WORKS */}
      <section id="features" className="space-y-12 sm:space-y-16 scroll-mt-24">
        {/* About card */}
        <div className="max-w-4xl mx-auto rounded-3xl border-2 border-black bg-[#FFFDF8] p-6 sm:p-10 shadow-[6px_6px_0px_#18181B] relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFD21E] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000]">
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>ABOUT SHOTZI • WHY WE BUILT THIS</span>
            </div>
            <span className="font-mono text-xs font-bold text-zinc-500 uppercase tracking-wider">
              An Indie Social Space
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#18181B] tracking-tight leading-[1.1]">
                A soft place for loud feelings — built for real human moments.
              </h2>
              <p className="text-sm sm:text-base text-zinc-700 font-medium leading-relaxed">
                Shotzi is an indie visual sanctuary — part scrapbook, part live community. Share quiet sunsets, late-night walks, accidental beauty, and messy camera roll dumps without performance anxiety.
              </p>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium leading-relaxed">
                No algorithmic rat-race chasing virality. No vanity metrics or beauty filters. Just genuine people sharing honest glimpses into their everyday lives.
              </p>
              <div className="pt-2">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-black bg-[#FFD21E] hover:bg-[#ffe066] px-5 py-2.5 rounded-full border-2 border-black shadow-[2.5px_2.5px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  <span>Read our story & manifesto</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {[
                { icon: "🚫", title: "Zero Ads & No Data Selling", desc: "Your privacy is respected. You are never the product." },
                { icon: "📷", title: "100% Photo Ownership", desc: "Your shots belong to you forever. No licensing tricks." },
                { icon: "⚡", title: "Real-Time Live Rooms", desc: "Drop into cozy community rooms for spontaneous chats." },
                { icon: "⏱️", title: "Pure Chronological Feed", desc: "See what just happened, exactly when it was shared." },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 p-3.5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 transition-transform"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FAF7F0] border border-black flex items-center justify-center text-lg shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-black">{item.title}</h4>
                    <p className="text-[11px] text-zinc-500 font-medium leading-snug mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div id="how-it-works" className="max-w-4xl mx-auto space-y-8 scroll-mt-24">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18181B] text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000]">
              HOW SHOTZI WORKS
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] tracking-tight">
              Get started in 3 simple steps
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 font-medium max-w-md mx-auto">
              No complicated setups or waitlists. From zero to sharing your world in under a minute.
            </p>
          </div>

          {/* 3 Step Cards Flow Diagram */}
          <div className="relative">
            {/* Connecting arrows for desktop */}
            <div className="hidden md:flex absolute top-1/2 left-[33.3%] -translate-x-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_#000] items-center justify-center font-black text-sm text-black pointer-events-none">
              →
            </div>
            <div className="hidden md:flex absolute top-1/2 left-[66.6%] -translate-x-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_#000] items-center justify-center font-black text-sm text-black pointer-events-none">
              →
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              {/* Step 1 */}
              <div className="group rounded-3xl border-2 border-black bg-white p-6 shadow-[5px_5px_0px_#18181B] hover:shadow-[7px_7px_0px_#18181B] hover:-translate-y-1 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#FFD21E] text-black font-mono font-black text-[11px] border border-black shadow-[1px_1px_0px_#000]">
                      STEP 01
                    </span>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Takes 10s</span>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-[#FFD21E] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-2xl mb-4 group-hover:rotate-6 transition-transform">
                    ✨
                  </div>
                  <h3 className="text-lg font-black text-black mb-1.5">Create your space</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
                    Sign up with email or Google. No invite codes, no credit cards, completely free forever.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-black/10 flex items-center gap-1.5 text-xs font-bold text-[#B45309]">
                  <span>⚡ Instant account</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="group rounded-3xl border-2 border-black bg-white p-6 shadow-[5px_5px_0px_#18181B] hover:shadow-[7px_7px_0px_#18181B] hover:-translate-y-1 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#FF5376] text-white font-mono font-black text-[11px] border border-black shadow-[1px_1px_0px_#000]">
                      STEP 02
                    </span>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Unfiltered</span>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-[#FF5376] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-2xl mb-4 group-hover:-rotate-6 transition-transform">
                    📸
                  </div>
                  <h3 className="text-lg font-black text-black mb-1.5">Dump your shots</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
                    Upload candid camera roll photos, tag your mood, and caption what you felt. No posing, no curation.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-black/10 flex items-center gap-1.5 text-xs font-bold text-[#FF5376]">
                  <span>📷 Real & unedited</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="group rounded-3xl border-2 border-black bg-white p-6 shadow-[5px_5px_0px_#18181B] hover:shadow-[7px_7px_0px_#18181B] hover:-translate-y-1 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#22C55E] text-black font-mono font-black text-[11px] border border-black shadow-[1px_1px_0px_#000]">
                      STEP 03
                    </span>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Community</span>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-[#DCFCE7] text-emerald-800 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-2xl mb-4 group-hover:rotate-6 transition-transform">
                    💬
                  </div>
                  <h3 className="text-lg font-black text-black mb-1.5">Connect & discover</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
                    Drop into live chat rooms, follow creators whose mood matches yours, and leave heartwarming notes.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-black/10 flex items-center gap-1.5 text-xs font-bold text-[#16A34A]">
                  <span>🌐 Live chat & feed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTA Bar */}
          <div className="rounded-2xl border-2 border-black bg-[#FAF7F0] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[3px_3px_0px_#000]">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-[#FFD21E] border-2 border-black flex items-center justify-center font-bold text-lg shrink-0 shadow-[1px_1px_0px_#000]">
                ✨
              </div>
              <div>
                <p className="text-sm font-black text-[#18181B]">Ready to dump what you felt today?</p>
                <p className="text-xs text-zinc-600 font-medium">Join a welcoming community sharing real, honest moments.</p>
              </div>
            </div>
            <button
              onClick={() => openAuth("signup")}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#FFD21E] text-black font-black text-sm border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start for free — takes 10 seconds</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* FINAL CTA BANNER */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-black bg-[#FFD21E] p-8 sm:p-12 shadow-[6px_6px_0px_#18181B]">
        <img src="/auth/peeking_cat.png" alt="Shotzi Mascot" className="absolute -bottom-2 -right-2 sm:right-6 w-24 sm:w-32 pointer-events-none select-none drop-shadow-sm" />
        <div className="max-w-xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-black font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000]">
            CAPTURE • SHARE • CONNECT
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-[#18181B] tracking-tight leading-tight">
            Your moments.<br />Your people.<br />Your Shotzi.
          </h2>
          <p className="text-sm sm:text-base text-zinc-800 font-semibold leading-relaxed">
            Create your account in seconds and be part of a community that values real moments over curated illusions.
          </p>
          <div className="flex items-center gap-4 flex-wrap pt-2">
            <button
              onClick={() => openAuth("signup")}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-black text-white font-black text-sm sm:text-base border-2 border-black shadow-[3px_3px_0px_#fff] hover:bg-zinc-800 hover:-translate-y-0.5 transition-all"
            >
              <span>Get Started — It&apos;s Free</span><span>→</span>
            </button>
            <button
              onClick={() => openAuth("signin")}
              className="text-xs sm:text-sm font-black text-black underline decoration-2 underline-offset-4 hover:opacity-80"
            >
              Sign in to your account →
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
