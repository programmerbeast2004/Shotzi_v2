"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, getAuthUser } from "../../lib/supabaseClient";
import { isAdmin } from "../../lib/admin";
import { isOnline } from "../../components/lastSeen";
import {
  Heart,
  MessageCircle,
  Share2,
  Download,
  Trash2,
  ArrowLeft,
  X,
  Send,
  Camera,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Film,
} from "lucide-react";
import { useToast } from "../../components/Toast";
import { useAuthDrawer } from "../../components/AuthDrawer";
import AuthBarrier from "../../components/AuthBarrier";

const PAGE_SIZE = 12;

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ReelsPage() {
  const [reels, setReels] = useState([]);
  const [user, setUser] = useState(null);
  const [likedIds, setLikedIds] = useState([]);
  const [likeCounts, setLikeCounts] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [activeComments, setActiveComments] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState({});
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [heartAnimId, setHeartAnimId] = useState(null);
  const [expandedCaptionId, setExpandedCaptionId] = useState(null);

  const isFetchingRef = useRef(false);
  const pageRef = useRef(0);
  const mobileContainerRef = useRef(null);
  const desktopContainerRef = useRef(null);
  const mobileSlideRefs = useRef([]);
  const desktopSlideRefs = useRef([]);
  const mobileObserverRef = useRef(null);
  const desktopObserverRef = useRef(null);
  const lastTapRef = useRef(0);

  const router = useRouter();
  const toast = useToast();
  const { openAuth } = useAuthDrawer();

  // Load authenticated user
  useEffect(() => {
    let mounted = true;
    getAuthUser().then((u) => {
      if (!mounted) return;
      setUser(u);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Sync user's liked posts
  useEffect(() => {
    if (!user) {
      setLikedIds([]);
      return;
    }
    let mounted = true;
    supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (mounted && data) {
          setLikedIds((prev) =>
            Array.from(new Set([...prev, ...data.map((r) => r.post_id)]))
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Load initial batch of reels reliably on mount
  const loadInitialReels = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);

    try {
      const { data: postRows, error } = await supabase
        .from("posts")
        .select("id, image_url, caption, created_at, user_id, user_email")
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) {
        console.error("Failed to load initial reels from Supabase:", error);
        setHasMore(false);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      if (!postRows || postRows.length === 0) {
        setReels([]);
        setHasMore(false);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      const postIds = postRows.map((r) => r.id);
      const userIds = Array.from(
        new Set(postRows.map((r) => r.user_id).filter(Boolean))
      );

      // Fetch profiles, likes, and comments in parallel
      const [{ data: profileRows }, { data: likeRows }, { data: commentRows }] =
        await Promise.all([
          userIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url, last_active")
                .in("id", userIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from("likes")
            .select("post_id, user_id")
            .in("post_id", postIds),
          supabase
            .from("comments")
            .select("post_id")
            .in("post_id", postIds),
        ]);

      const profileMap = (profileRows || []).reduce((acc, p) => {
        if (p?.id) acc[p.id] = p;
        return acc;
      }, {});

      const newLikeCounts = {};
      const newLikedByUser = [];
      (likeRows || []).forEach((row) => {
        newLikeCounts[row.post_id] = (newLikeCounts[row.post_id] || 0) + 1;
        if (userRef.current && row.user_id === userRef.current.id) {
          newLikedByUser.push(row.post_id);
        }
      });

      const newCommentCounts = {};
      (commentRows || []).forEach((row) => {
        newCommentCounts[row.post_id] =
          (newCommentCounts[row.post_id] || 0) + 1;
      });

      const formatted = postRows.map((r) => {
        const p = profileMap[r.user_id];
        const fallbackName =
          r.user_email?.split("@")[0] || r.user_id?.slice(0, 6) || "user";
        return {
          ...r,
          profile: {
            username: p?.username || fallbackName,
            display_name: p?.display_name || fallbackName,
            avatar_url: p?.avatar_url || null,
            last_active: p?.last_active || null,
          },
        };
      });

      setLikeCounts((prev) => ({ ...prev, ...newLikeCounts }));
      setCommentCounts((prev) => ({ ...prev, ...newCommentCounts }));
      if (newLikedByUser.length > 0) {
        setLikedIds((prev) =>
          Array.from(new Set([...prev, ...newLikedByUser]))
        );
      }

      setReels(formatted);
      pageRef.current = 0;
      if (postRows.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err) {
      console.error("Failed to load initial reels:", err);
      toast?.error?.("Error loading roll");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [toast]);

  // Load next page of reels for infinite scroll
  const loadMoreReels = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || loading) return;
    isFetchingRef.current = true;
    const nextPage = pageRef.current + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data: postRows, error } = await supabase
        .from("posts")
        .select("id, image_url, caption, created_at, user_id, user_email")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error || !postRows || postRows.length === 0) {
        setHasMore(false);
        return;
      }

      const postIds = postRows.map((r) => r.id);
      const userIds = Array.from(
        new Set(postRows.map((r) => r.user_id).filter(Boolean))
      );

      const [{ data: profileRows }, { data: likeRows }, { data: commentRows }] =
        await Promise.all([
          userIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url, last_active")
                .in("id", userIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from("likes")
            .select("post_id, user_id")
            .in("post_id", postIds),
          supabase
            .from("comments")
            .select("post_id")
            .in("post_id", postIds),
        ]);

      const profileMap = (profileRows || []).reduce((acc, p) => {
        if (p?.id) acc[p.id] = p;
        return acc;
      }, {});

      const newLikeCounts = {};
      const newLikedByUser = [];
      (likeRows || []).forEach((row) => {
        newLikeCounts[row.post_id] = (newLikeCounts[row.post_id] || 0) + 1;
        if (userRef.current && row.user_id === userRef.current.id) {
          newLikedByUser.push(row.post_id);
        }
      });

      const newCommentCounts = {};
      (commentRows || []).forEach((row) => {
        newCommentCounts[row.post_id] =
          (newCommentCounts[row.post_id] || 0) + 1;
      });

      const formatted = postRows.map((r) => {
        const p = profileMap[r.user_id];
        const fallbackName =
          r.user_email?.split("@")[0] || r.user_id?.slice(0, 6) || "user";
        return {
          ...r,
          profile: {
            username: p?.username || fallbackName,
            display_name: p?.display_name || fallbackName,
            avatar_url: p?.avatar_url || null,
            last_active: p?.last_active || null,
          },
        };
      });

      setLikeCounts((prev) => ({ ...prev, ...newLikeCounts }));
      setCommentCounts((prev) => ({ ...prev, ...newCommentCounts }));
      if (newLikedByUser.length > 0) {
        setLikedIds((prev) =>
          Array.from(new Set([...prev, ...newLikedByUser]))
        );
      }

      setReels((prev) => {
        const existingIds = new Set(prev.map((x) => x.id));
        const filtered = formatted.filter((x) => !existingIds.has(x.id));
        return [...prev, ...filtered];
      });

      pageRef.current = nextPage;
      if (postRows.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load more reels:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [hasMore, loading]);

  // Initial load on mount
  useEffect(() => {
    if (user) {
      loadInitialReels();
    } else {
      setLoading(false);
    }
  }, [user, loadInitialReels]);

  // Preload comments for the active reel
  useEffect(() => {
    if (reels[activeSlideIndex]) {
      const activeId = reels[activeSlideIndex].id;
      if (!comments[activeId]) {
        loadComments(activeId);
      }
    }
  }, [activeSlideIndex, reels]);

  // Intersection observer for infinite scroll at the bottom (only when reels are loaded)
  useEffect(() => {
    if (!hasMore || reels.length === 0) return;

    const attachObserver = (el) => {
      if (!el) return null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isFetchingRef.current && hasMore) {
            loadMoreReels();
          }
        },
        { threshold: 0.1, rootMargin: "250px" }
      );
      observer.observe(el);
      return observer;
    };

    const mobileObs = attachObserver(mobileObserverRef.current);
    const desktopObs = attachObserver(desktopObserverRef.current);

    return () => {
      mobileObs?.disconnect();
      desktopObs?.disconnect();
    };
  }, [hasMore, reels.length, loadMoreReels]);

  // Track active slide index via scroll observer on active container
  useEffect(() => {
    const handleContainerScroll = (container, slideRefsList) => {
      if (!container) return;
      const scrollPos = container.scrollTop + container.clientHeight / 2;
      let closestIdx = 0;
      let minDistance = Infinity;

      slideRefsList.current.forEach((ref, idx) => {
        if (!ref) return;
        const top = ref.offsetTop;
        const height = ref.offsetHeight;
        const center = top + height / 2;
        const distance = Math.abs(scrollPos - center);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      });

      setActiveSlideIndex(closestIdx);
    };

    const mContainer = mobileContainerRef.current;
    const dContainer = desktopContainerRef.current;

    const onMobileScroll = () => handleContainerScroll(mContainer, mobileSlideRefs);
    const onDesktopScroll = () => handleContainerScroll(dContainer, desktopSlideRefs);

    mContainer?.addEventListener("scroll", onMobileScroll, { passive: true });
    dContainer?.addEventListener("scroll", onDesktopScroll, { passive: true });

    return () => {
      mContainer?.removeEventListener("scroll", onMobileScroll);
      dContainer?.removeEventListener("scroll", onDesktopScroll);
    };
  }, [reels]);

  // Keyboard navigation (Up / Down / Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Escape") {
        if (activeComments) {
          setActiveComments(null);
        } else {
          router.push("/");
        }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        scrollToSlide(activeSlideIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        scrollToSlide(activeSlideIndex - 1);
      } else if (e.key === "l" && reels[activeSlideIndex]) {
        toggleLike(reels[activeSlideIndex].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSlideIndex, reels, activeComments, router]);

  const scrollToSlide = (idx) => {
    if (idx < 0 || idx >= reels.length) return;
    const mTarget = mobileSlideRefs.current[idx];
    if (mTarget) {
      mTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    const dTarget = desktopSlideRefs.current[idx];
    if (dTarget) {
      dTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  // Heart animation trigger
  const triggerHeartBurst = (postId) => {
    setHeartAnimId(postId);
    setTimeout(() => {
      setHeartAnimId((current) => (current === postId ? null : current));
    }, 700);
  };

  // Like / Unlike action
  const toggleLike = async (postId, forceLike = false) => {
    if (!user) {
      openAuth("signin");
      return;
    }

    const isLiked = likedIds.includes(postId);
    if (forceLike && isLiked) {
      triggerHeartBurst(postId);
      return;
    }

    const willLike = !isLiked;
    if (willLike) triggerHeartBurst(postId);

    setLikedIds((prev) =>
      willLike ? [...prev, postId] : prev.filter((id) => id !== postId)
    );
    setLikeCounts((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] || 0) + (willLike ? 1 : -1)),
    }));

    try {
      if (willLike) {
        await supabase.from("likes").insert({
          user_id: user.id,
          post_id: postId,
        });
      } else {
        await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", postId);
      }
    } catch (err) {
      setLikedIds((prev) =>
        !willLike ? [...prev, postId] : prev.filter((id) => id !== postId)
      );
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 0) + (!willLike ? 1 : -1)),
      }));
      toast?.error?.("Failed to update like");
    }
  };

  const handlePhotoDoubleTap = (postId) => {
    toggleLike(postId, true);
  };

  const handleTouchEnd = (e, postId) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      e.preventDefault();
      handlePhotoDoubleTap(postId);
    }
    lastTapRef.current = now;
  };

  // Load comments for a post
  const loadComments = async (postId) => {
    setLoadingComments(true);
    try {
      const { data: commentRows, error } = await supabase
        .from("comments")
        .select("id, content, user_id, user_email, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const userIds = Array.from(
        new Set((commentRows || []).map((c) => c.user_id))
      );
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      const map = (profs || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const mapped = (commentRows || []).map((c) => ({
        ...c,
        username:
          map[c.user_id]?.username ||
          c.user_email?.split("@")[0] ||
          "shotzi_lens",
        display_name:
          map[c.user_id]?.display_name ||
          map[c.user_id]?.username ||
          "Creator",
        avatar_url: map[c.user_id]?.avatar_url || null,
      }));

      setComments((prev) => ({ ...prev, [postId]: mapped }));
      setCommentCounts((prev) => ({
        ...prev,
        [postId]: mapped.length,
      }));
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  // Submit new comment
  const handleCommentSubmit = async (postId) => {
    if (!user) {
      openAuth("signin");
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed || submittingComment) return;

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          user_email: user.email,
          content: trimmed,
        })
        .select()
        .single();

      if (error) throw error;

      const newComment = {
        ...data,
        username:
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "you",
        display_name:
          user.user_metadata?.display_name ||
          user.user_metadata?.username ||
          "You",
        avatar_url: user.user_metadata?.avatar_url || null,
      };

      setComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setCommentCounts((prev) => ({
        ...prev,
        [postId]: (prev[postId] || 0) + 1,
      }));
      setCommentText("");
      toast?.success?.("Note posted to roll");
    } catch (err) {
      toast?.error?.("Failed to add note.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete shot
  const deletePost = async (postId) => {
    if (!user) return;
    if (!confirm("Permanently remove this shot from the Shotzi Roll?")) return;
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId);

    if (error) {
      toast?.error?.("Failed to delete shot.");
      return;
    }
    setReels((prev) => prev.filter((r) => r.id !== postId));
    toast?.success?.("Shot removed from roll.");
  };

  // Share post
  const sharePost = async (postId) => {
    const url = `${
      typeof window !== "undefined" ? window.location.origin : ""
    }/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Shotzi Infinite Roll Moment",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast?.success?.("Link copied to clipboard!");
      }
    } catch (e) {
      // Ignored if cancelled
    }
  };

  const activeReel = reels[activeSlideIndex] || null;

  if (authLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-3 border-black border-t-[#FFD21E] rounded-full animate-spin" />
        <p className="font-bold text-sm text-zinc-600">Loading infinite roll...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthBarrier
        title="Infinite Photo Roll"
        subtitle="Sign in to explore camera roll dumps, serendipitous moments, and candid community shots."
        badge="MEMBERS ONLY • INFINITE"
        icon={<Film className="w-7 h-7 text-black stroke-[2.5]" />}
      />
    );
  }

  return (
    <>
      {/* =========================================================================
          1. SMALL & MOBILE DEVICES (< lg): THE IMMERSIVE FULL-SCREEN ROLL
          Restored to the clean, uncluttered, edge-to-edge layout the user loved!
          ========================================================================= */}
      <div className="lg:hidden fixed inset-0 bg-[#121214] text-white flex flex-col overflow-hidden select-none z-50 font-sans">
        {/* Minimal Compact Header: fits 320px screens with zero line wrapping */}
        <header className="h-14 px-3 shrink-0 flex items-center justify-between border-b-2 border-black bg-[#1A1A1E] z-40 relative">
          {/* Left: Circle back button */}
          <Link
            href="/"
            className="w-8 h-8 rounded-full bg-[#FAF7F0] hover:bg-[#FFD21E] text-black border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_#000] active:scale-95 transition-all shrink-0"
            title="Return to feed"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </Link>

          {/* Center: Infinite Roll Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD21E] text-black border-2 border-black font-black text-xs uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000] shrink-0">
            <Film className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Infinite Roll</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 border border-black animate-pulse" />
          </div>

          {/* Right: Quick Up/Down Navigation Controls */}
          <div className="flex items-center gap-1 bg-black/60 border border-white/20 rounded-full p-0.5 shrink-0">
            <button
              onClick={() => scrollToSlide(activeSlideIndex - 1)}
              disabled={activeSlideIndex <= 0}
              className="p-1 rounded-full text-zinc-300 hover:text-black hover:bg-[#FFD21E] transition-all disabled:opacity-30 disabled:pointer-events-none"
              title="Previous shot (Up)"
            >
              <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <span className="text-[10px] font-mono font-bold px-1 text-zinc-300">
              {reels.length > 0 ? `${activeSlideIndex + 1}/${reels.length}` : "0/0"}
            </span>
            <button
              onClick={() => scrollToSlide(activeSlideIndex + 1)}
              disabled={activeSlideIndex >= reels.length - 1}
              className="p-1 rounded-full text-zinc-300 hover:text-black hover:bg-[#FFD21E] transition-all disabled:opacity-30 disabled:pointer-events-none"
              title="Next shot (Down)"
            >
              <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </header>

        {/* Mobile Snap-Scroll Viewport */}
        <main
          ref={mobileContainerRef}
          className="flex-1 w-full overflow-y-auto snap-y snap-mandatory scroll-smooth relative overscroll-y-contain"
          style={{ scrollSnapStop: "always" }}
        >
          {/* Loading */}
          {loading && reels.length === 0 && (
            <div className="h-full w-full flex flex-col items-center justify-center p-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center animate-bounce shadow-[3px_3px_0px_#000]">
                <Camera className="w-7 h-7 text-black stroke-[2.5]" />
              </div>
              <p className="font-black text-sm text-zinc-200 uppercase tracking-wide">
                Developing Roll...
              </p>
            </div>
          )}

          {/* Empty */}
          {!loading && reels.length === 0 && (
            <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-[#FAF7F0] border-2 border-black rounded-3xl p-6 max-w-xs w-full text-black space-y-3 shadow-[4px_4px_0px_#FFD21E]">
                <Film className="w-8 h-8 mx-auto text-black stroke-[2.5]" />
                <h3 className="font-black text-lg">Roll is Empty</h3>
                <Link
                  href="/"
                  className="inline-block w-full py-2 bg-[#FFD21E] border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000]"
                >
                  Back to Feed
                </Link>
              </div>
            </div>
          )}

          {/* Reel Slides */}
          {reels.map((reel, idx) => {
            const isLiked = likedIds.includes(reel.id);
            const currentLikes = likeCounts[reel.id] ?? 0;
            const currentComments = commentCounts[reel.id] ?? 0;
            const isOwner = user && user.id === reel.user_id;
            const isUserAdmin = user && isAdmin(user);
            const authorOnline = isOnline(reel.profile.last_active);
            const isHeartActive = heartAnimId === reel.id;
            const isCaptionExpanded = expandedCaptionId === reel.id;

            return (
              <section
                key={reel.id}
                ref={(el) => (mobileSlideRefs.current[idx] = el)}
                className="h-[calc(100dvh-56px)] w-full snap-start snap-always relative overflow-hidden flex flex-col justify-between"
              >
                {/* Author Pill Overlay */}
                <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
                  <Link
                    href={`/profile/${reel.profile.username}`}
                    className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF7F0] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] max-w-[70%]"
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-black bg-zinc-200 shrink-0">
                      {reel.profile.avatar_url ? (
                        <img
                          src={reel.profile.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase bg-[#FFD21E] text-black">
                          {reel.profile.username[0]}
                        </div>
                      )}
                    </div>
                    <span
                      className={`w-1.5 h-1.5 rounded-full border border-black shrink-0 ${
                        authorOnline ? "bg-emerald-500" : "bg-zinc-400"
                      }`}
                    />
                    <span className="truncate">@{reel.profile.username}</span>
                  </Link>

                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/80 border border-white/20 text-[10px] font-mono text-zinc-300">
                    <span className="text-[#FFD21E] font-bold">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                </div>

                {/* Photo Center */}
                <div
                  onDoubleClick={() => handlePhotoDoubleTap(reel.id)}
                  onTouchEnd={(e) => handleTouchEnd(e, reel.id)}
                  className="relative flex-1 w-full h-full flex items-center justify-center bg-[#0e0e10] cursor-pointer"
                >
                  <img
                    src={reel.image_url}
                    alt=""
                    className="w-full h-full object-contain pointer-events-none select-none"
                    loading="lazy"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />

                  {isHeartActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                      <div className="animate-ping duration-500">
                        <Heart className="w-20 h-20 text-[#FF5376] fill-[#FF5376] drop-shadow-[0_0_15px_rgba(255,83,118,0.8)]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Caption */}
                <div className="absolute bottom-3 left-3 right-16 z-20 flex flex-col gap-1 pointer-events-auto">
                  <div className="text-[10px] font-mono text-zinc-400">
                    {reel.profile.display_name} • {formatTimeAgo(reel.created_at)}
                  </div>
                  {reel.caption && (
                    <p
                      className={`text-xs font-bold text-zinc-100 leading-snug break-words ${
                        isCaptionExpanded ? "" : "line-clamp-2"
                      }`}
                    >
                      {reel.caption}
                    </p>
                  )}
                </div>

                {/* Right Action Rail */}
                <aside className="absolute bottom-3 right-3 z-30 flex flex-col items-center gap-2.5 pointer-events-auto">
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggleLike(reel.id)}
                      className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] active:scale-95 transition-all ${
                        isLiked
                          ? "bg-[#FF5376] text-white"
                          : "bg-white text-black hover:bg-[#FFD21E]"
                      }`}
                      aria-label="Like"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          isLiked ? "fill-white text-white" : "stroke-[2.5]"
                        }`}
                      />
                    </button>
                    <span className="text-[10px] font-black font-mono text-white">
                      {currentLikes}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveComments(reel.id);
                        loadComments(reel.id);
                      }}
                      className="w-10 h-10 rounded-full bg-white text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] active:scale-95 transition-all"
                      aria-label="Comments"
                    >
                      <MessageCircle className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <span className="text-[10px] font-black font-mono text-white">
                      {currentComments}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => sharePost(reel.id)}
                    className="w-10 h-10 rounded-full bg-white text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] active:scale-95 transition-all"
                    aria-label="Share"
                  >
                    <Share2 className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <a
                    href={reel.image_url}
                    download={`shotzi-${reel.id}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-10 h-10 rounded-full bg-white text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] active:scale-95 transition-all"
                    aria-label="Download"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                  </a>

                  {(isOwner || isUserAdmin) && (
                    <button
                      type="button"
                      onClick={() => deletePost(reel.id)}
                      className="w-10 h-10 rounded-full bg-[#EF4444] text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] active:scale-95 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  )}
                </aside>

                {/* Slide-Up Comments Drawer */}
                {activeComments === reel.id && (
                  <div className="absolute inset-x-0 bottom-0 max-h-[75%] bg-[#FAF7F0] border-t-3 border-black rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.6)] z-40 flex flex-col text-black animate-in slide-in-from-bottom-5 duration-200">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#FFD21E] border-b-2 border-black rounded-t-3xl">
                      <div className="flex items-center gap-1.5 font-black text-xs uppercase">
                        <MessageCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Notes ({comments[reel.id]?.length || 0})</span>
                      </div>
                      <button
                        onClick={() => setActiveComments(null)}
                        className="p-1 rounded-full bg-white border-2 border-black text-black shadow-[1.5px_1.5px_0px_#000]"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[220px]">
                      {(comments[reel.id] || []).length === 0 ? (
                        <p className="text-center text-xs text-zinc-500 py-6">
                          No notes yet. Leave a kind thought!
                        </p>
                      ) : (
                        (comments[reel.id] || []).map((c) => (
                          <div
                            key={c.id}
                            className="bg-white border-2 border-black rounded-xl p-2 text-xs shadow-[1.5px_1.5px_0px_#000]"
                          >
                            <span className="font-black text-black">@{c.username}: </span>
                            <span className="text-zinc-800">{c.content}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-2.5 border-t-2 border-black bg-white rounded-b-3xl">
                      {user ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleCommentSubmit(reel.id);
                          }}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Add a kind note..."
                            className="flex-1 bg-[#FAF7F0] border-2 border-black px-3 py-1.5 rounded-xl text-xs font-semibold text-black outline-none focus:ring-2 focus:ring-[#FFD21E]"
                          />
                          <button
                            type="submit"
                            disabled={!commentText.trim() || submittingComment}
                            className="px-3.5 py-1.5 rounded-xl bg-[#FFD21E] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000]"
                          >
                            Post
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => openAuth("signin")}
                          className="w-full text-center text-xs font-bold text-black underline py-1"
                        >
                          Sign in to leave a note
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {loading && reels.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-[3px] border-black border-t-[#FFD21E] animate-spin" />
              <p className="text-xs font-mono tracking-wider text-zinc-300 uppercase font-bold">
                Developing Roll...
              </p>
            </div>
          )}

          {!loading && reels.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <Film className="w-10 h-10 text-[#FFD21E] stroke-[2]" />
              <p className="text-sm font-bold text-white">No shots on the roll yet</p>
              <button
                onClick={() => loadInitialReels()}
                className="px-4 py-2 rounded-xl bg-[#FFD21E] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000]"
              >
                Refresh Roll
              </button>
            </div>
          )}

          {reels.length > 0 && (
            <div
              ref={mobileObserverRef}
              className="h-12 w-full flex items-center justify-center text-xs font-mono text-zinc-400"
            >
              {loading ? "Developing more..." : !hasMore ? "• End of roll •" : ""}
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          2. LARGE SCREENS (lg+): 35MM STUDIO SUITE
          Fills the large desktop display with rich context, no empty awkward void!
          ========================================================================= */}
      <div className="hidden lg:block w-full relative select-none font-sans pb-6">
        {/* Ambient Glow */}
        {activeReel && (
          <div
            className="fixed inset-0 pointer-events-none opacity-20 -z-10 transition-all duration-700 blur-[100px] scale-125"
            style={{
              backgroundImage: `url(${activeReel.image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        {/* Desktop Top Toolbar */}
        <div className="w-full max-w-6xl mx-auto mb-4 px-2 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#FFD21E] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 transition-all duration-150 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5] transition-transform group-hover:-translate-x-0.5" />
            <span>Feed</span>
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFD21E] text-black border-2 border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#18181B]">
            <Film className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>35mm Infinite Studio</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 border border-black animate-pulse" />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-white border-2 border-black rounded-full p-0.5 shadow-[2px_2px_0px_#18181B]">
              <button
                onClick={() => scrollToSlide(activeSlideIndex - 1)}
                disabled={activeSlideIndex <= 0}
                className="p-1 rounded-full text-zinc-700 hover:text-black hover:bg-[#FFD21E] transition-all disabled:opacity-30 disabled:pointer-events-none"
                title="Previous (Up)"
              >
                <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <span className="text-[10px] font-mono font-bold px-1.5 text-black">
                {reels.length > 0 ? `${activeSlideIndex + 1}/${reels.length}` : "0/0"}
              </span>
              <button
                onClick={() => scrollToSlide(activeSlideIndex + 1)}
                disabled={activeSlideIndex >= reels.length - 1}
                className="p-1 rounded-full text-zinc-700 hover:text-black hover:bg-[#FFD21E] transition-all disabled:opacity-30 disabled:pointer-events-none"
                title="Next (Down)"
              >
                <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* 3-Column Desktop Grid */}
        <div className="w-full max-w-6xl mx-auto grid grid-cols-12 gap-6 items-start">
          {/* Left Column: Roll Stream Navigator */}
          <aside className="col-span-3 flex flex-col bg-white border-2 border-black rounded-3xl p-3.5 shadow-[4px_4px_0px_#18181B] h-[calc(100vh-210px)] min-h-[580px] max-h-[760px] overflow-hidden justify-between">
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                <div className="flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-black stroke-[2.5]" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-black">
                    Roll Stream
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#FFD21E] px-2 py-0.5 rounded-full border border-black text-black">
                  {reels.length} Shots
                </span>
              </div>

              <div className="flex-1 overflow-y-auto py-2.5 space-y-2 pr-1 soft-scroll">
                {reels.map((item, idx) => {
                  const isSelected = activeSlideIndex === idx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSlide(idx)}
                      className={`w-full text-left p-2 rounded-2xl border-2 transition-all flex items-center gap-2.5 ${
                        isSelected
                          ? "bg-[#FFD21E] border-black shadow-[3px_3px_0px_#18181B] scale-[1.02]"
                          : "bg-zinc-50 hover:bg-zinc-100 border-black/15 shadow-xs"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-black/30 bg-zinc-200 shrink-0">
                        <img
                          src={item.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono font-bold text-zinc-500">
                            #{String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500">
                            {formatTimeAgo(item.created_at)}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-black truncate leading-tight mt-0.5">
                          @{item.profile.username}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-0.5">
                          <span className="inline-flex items-center gap-0.5">
                            <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                            <span>{likeCounts[item.id] || 0}</span>
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <MessageCircle className="w-2.5 h-2.5 text-zinc-500" />
                            <span>{commentCounts[item.id] || 0}</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t-2 border-black/10 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
                <span>Shotzi 400 Color</span>
                <span className="text-black font-bold">↑ ↓ to navigate</span>
              </div>
            </div>
          </aside>

          {/* Center Column: 35mm Slide Card */}
          <div className="col-span-5 flex flex-col items-center justify-center">
            <div
              ref={desktopContainerRef}
              className="w-full max-w-[460px] h-[calc(100vh-210px)] min-h-[580px] max-h-[760px] overflow-y-auto snap-y snap-mandatory scroll-smooth rounded-3xl relative overscroll-y-contain border-[3px] border-black shadow-[8px_8px_0px_#FFD21E] bg-[#121214] text-white"
              style={{ scrollSnapStop: "always" }}
            >
              {reels.map((reel, idx) => {
                const isLiked = likedIds.includes(reel.id);
                const currentLikes = likeCounts[reel.id] ?? 0;
                const authorOnline = isOnline(reel.profile.last_active);
                const isHeartActive = heartAnimId === reel.id;

                return (
                  <section
                    key={reel.id}
                    ref={(el) => (desktopSlideRefs.current[idx] = el)}
                    className="h-full w-full snap-start snap-always relative overflow-hidden flex flex-col justify-between"
                  >
                    {/* Top Overlay */}
                    <div className="absolute top-0 inset-x-0 h-14 px-4 z-20 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                      <Link
                        href={`/profile/${reel.profile.username}`}
                        className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF7F0] hover:bg-[#FFD21E] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] transition-all"
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden border border-black bg-zinc-200 shrink-0">
                          {reel.profile.avatar_url ? (
                            <img
                              src={reel.profile.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase bg-[#FFD21E] text-black">
                              {reel.profile.username[0]}
                            </div>
                          )}
                        </div>
                        <span
                          className={`w-2 h-2 rounded-full border border-black shrink-0 ${
                            authorOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-zinc-400"
                          }`}
                        />
                        <span className="truncate">@{reel.profile.username}</span>
                      </Link>

                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/80 border border-white/20 text-[10px] font-mono text-zinc-300">
                        <span>FRAME</span>
                        <span className="font-bold text-[#FFD21E]">
                          #{String(idx + 1).padStart(2, "0")}
                        </span>
                      </div>
                    </div>

                    {/* Photo Area */}
                    <div
                      onDoubleClick={() => handlePhotoDoubleTap(reel.id)}
                      className="relative flex-1 w-full h-full flex items-center justify-center bg-[#0e0e10] cursor-pointer overflow-hidden"
                    >
                      <img
                        src={reel.image_url}
                        alt=""
                        className="w-full h-full object-contain pointer-events-none select-none"
                        loading="lazy"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />

                      {isHeartActive && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                          <div className="animate-ping duration-500">
                            <Heart className="w-24 h-24 text-[#FF5376] fill-[#FF5376] drop-shadow-[0_0_20px_rgba(255,83,118,0.8)]" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Caption */}
                    <div className="absolute bottom-0 inset-x-0 z-20 p-4 pb-4 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col gap-1 pointer-events-auto pr-16">
                      <div className="text-[11px] font-mono text-zinc-400">
                        {reel.profile.display_name} • {formatTimeAgo(reel.created_at)}
                      </div>
                      {reel.caption && (
                        <p className="text-xs font-bold text-zinc-100 leading-snug line-clamp-2">
                          {reel.caption}
                        </p>
                      )}
                    </div>

                    {/* Right Tactile Rail */}
                    <aside className="absolute bottom-4 right-3 z-30 flex flex-col items-center gap-3 pointer-events-auto">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleLike(reel.id)}
                          className={`w-11 h-11 rounded-full border-2 border-black flex items-center justify-center shadow-[2.5px_2.5px_0px_#000] active:scale-95 transition-all ${
                            isLiked
                              ? "bg-[#FF5376] text-white"
                              : "bg-white text-black hover:bg-[#FFD21E]"
                          }`}
                        >
                          <Heart
                            className={`w-5 h-5 ${isLiked ? "fill-white text-white" : "stroke-[2.5]"}`}
                          />
                        </button>
                        <span className="text-[11px] font-black font-mono text-white">
                          {currentLikes}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => sharePost(reel.id)}
                        className="w-11 h-11 rounded-full bg-white text-black hover:bg-[#22C55E] hover:text-white border-2 border-black flex items-center justify-center shadow-[2.5px_2.5px_0px_#000] active:scale-95 transition-all"
                      >
                        <Share2 className="w-5 h-5 stroke-[2.5]" />
                      </button>

                      <a
                        href={reel.image_url}
                        download={`shotzi-${reel.id}.jpg`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-11 h-11 rounded-full bg-white text-black hover:bg-black hover:text-white border-2 border-black flex items-center justify-center shadow-[2.5px_2.5px_0px_#000] active:scale-95 transition-all"
                      >
                        <Download className="w-5 h-5 stroke-[2.5]" />
                      </a>

                      {(user && (user.id === reel.user_id || isAdmin(user))) && (
                        <button
                          type="button"
                          onClick={() => deletePost(reel.id)}
                          className="w-11 h-11 rounded-full bg-[#EF4444] text-white border-2 border-black flex items-center justify-center shadow-[2.5px_2.5px_0px_#000] active:scale-95 transition-all"
                        >
                          <Trash2 className="w-5 h-5 stroke-[2.5]" />
                        </button>
                      )}

                      {idx < reels.length - 1 && (
                        <button
                          type="button"
                          onClick={() => scrollToSlide(idx + 1)}
                          className="w-8 h-8 rounded-full bg-black/70 hover:bg-[#FFD21E] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all mt-1"
                        >
                          <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      )}
                    </aside>
                  </section>
                );
              })}

              {loading && reels.length === 0 && (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full border-[3px] border-black border-t-[#FFD21E] animate-spin" />
                  <p className="text-xs font-mono tracking-wider text-zinc-300 uppercase font-bold">
                    Developing 35mm Roll...
                  </p>
                </div>
              )}

              {!loading && reels.length === 0 && (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Film className="w-12 h-12 text-[#FFD21E] stroke-[2]" />
                  <p className="text-sm font-bold text-white">No shots on the roll yet</p>
                  <p className="text-xs text-zinc-400 max-w-xs">
                    Be the first to share an unfiltered shot to the 35mm studio stream!
                  </p>
                  <button
                    onClick={() => loadInitialReels()}
                    className="px-4 py-2 rounded-xl bg-[#FFD21E] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#ffe066] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  >
                    Refresh Roll
                  </button>
                </div>
              )}

              {reels.length > 0 && (
                <div
                  ref={desktopObserverRef}
                  className="h-14 w-full flex items-center justify-center text-xs font-mono text-zinc-400"
                >
                  {loading ? "Developing more..." : !hasMore ? "• End of roll •" : ""}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Creator & Conversation Panel */}
          <aside className="col-span-4 flex flex-col bg-white border-2 border-black rounded-3xl p-4 shadow-[4px_4px_0px_#18181B] h-[calc(100vh-210px)] min-h-[580px] max-h-[760px] overflow-hidden justify-between">
            {activeReel ? (
              <div className="flex flex-col h-full overflow-hidden justify-between">
                <div className="space-y-3 pb-3 border-b-2 border-black/10 shrink-0">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/profile/${activeReel.profile.username}`}
                      className="flex items-center gap-2.5 group"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-black bg-zinc-200 shrink-0 shadow-[1.5px_1.5px_0px_#18181B] group-hover:scale-105 transition-transform">
                        {activeReel.profile.avatar_url ? (
                          <img
                            src={activeReel.profile.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-black uppercase bg-[#FFD21E] text-black">
                            {activeReel.profile.username[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-black group-hover:underline truncate">
                            {activeReel.profile.display_name}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full border border-black shrink-0 ${
                              isOnline(activeReel.profile.last_active)
                                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                                : "bg-zinc-400"
                            }`}
                          />
                        </div>
                        <p className="text-[11px] font-mono text-zinc-500">
                          @{activeReel.profile.username}
                        </p>
                      </div>
                    </Link>

                    <Link
                      href={`/profile/${activeReel.profile.username}`}
                      className="px-2.5 py-1 rounded-full border border-black/20 bg-zinc-50 hover:bg-[#FFD21E] text-[11px] font-bold text-black transition-colors"
                    >
                      Profile
                    </Link>
                  </div>

                  {activeReel.caption ? (
                    <div className="bg-[#FAF7F0] border-2 border-black rounded-2xl p-3 shadow-[2px_2px_0px_#18181B]">
                      <p className="text-xs text-zinc-800 font-medium leading-relaxed break-words max-h-24 overflow-y-auto soft-scroll">
                        {activeReel.caption}
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-2 border-t border-black/10 mt-2">
                        <span>Recorded {formatTimeAgo(activeReel.created_at)}</span>
                        <span>Frame #{String(activeSlideIndex + 1).padStart(2, "0")}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-zinc-400 italic">
                      No caption recorded for this shot.
                    </div>
                  )}
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 soft-scroll min-h-0">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-black text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Roll Notes</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full border border-black/10">
                      {comments[activeReel.id]?.length || 0}
                    </span>
                  </div>

                  {loadingComments && !comments[activeReel.id] ? (
                    <div className="py-10 text-center text-xs font-mono text-zinc-400 animate-pulse">
                      Loading conversation...
                    </div>
                  ) : (comments[activeReel.id] || []).length === 0 ? (
                    <div className="py-8 text-center space-y-1">
                      <p className="text-xs font-bold text-zinc-700">
                        No notes on this frame yet.
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Leave the first note for @{activeReel.profile.username}!
                      </p>
                    </div>
                  ) : (
                    (comments[activeReel.id] || []).map((c) => (
                      <div
                        key={c.id}
                        className="bg-[#FAF7F0] border-2 border-black rounded-xl p-2.5 text-xs shadow-[2px_2px_0px_#18181B] flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/profile/${c.username}`}
                            className="font-black text-black hover:underline"
                          >
                            @{c.username}
                          </Link>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {formatTimeAgo(c.created_at)}
                          </span>
                        </div>
                        <p className="text-zinc-800 font-medium break-words text-[11px] leading-relaxed">
                          {c.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <div className="pt-3 border-t-2 border-black/10 shrink-0">
                  {user ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleCommentSubmit(activeReel.id);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a kind note to this shot..."
                        className="flex-1 bg-[#FAF7F0] border-2 border-black px-3 py-2 rounded-xl text-xs font-semibold text-black placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#FFD21E]"
                        maxLength={300}
                      />
                      <button
                        type="submit"
                        disabled={!commentText.trim() || submittingComment}
                        className="px-4 py-2 rounded-xl bg-[#FFD21E] hover:bg-[#ffdf58] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Post</span>
                      </button>
                    </form>
                  ) : (
                    <div className="text-center py-2 bg-zinc-50 border-2 border-black/10 rounded-xl">
                      <button
                        onClick={() => openAuth("signin")}
                        className="text-xs font-black text-black underline hover:text-zinc-700"
                      >
                        Sign in to comment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-mono text-zinc-400">
                Select a frame
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
