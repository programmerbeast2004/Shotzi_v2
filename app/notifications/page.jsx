"use client";

import { formatDistanceToNow } from "date-fns";
import {
    ArrowRight,
    BarChart3,
    Bell,
    Camera,
    Check,
    ChevronDown,
    Clock,
    Heart,
    MessageSquare,
    RotateCcw,
    Send,
    Settings,
    Shield,
    Users,
    X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthBarrier from "../../components/AuthBarrier";
import { useAuthDrawer } from "../../components/AuthDrawer";
import { useToast } from "../../components/Toast";
import { authFetch } from "../../lib/apiClient";
import { getAuthUser, supabase } from "../../lib/supabaseClient";

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [publishedPosts, setPublishedPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    approvals: 0,
    rejections: 0,
    comments: 0,
    likes: 0,
    invites: 0,
    system: 0,
  });
  const [quickStats, setQuickStats] = useState({
    publishedShots: 0,
    rejectedShots: 0,
    newComments: 0,
    totalLikes: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState(false);
  const [selectedRejection, setSelectedRejection] = useState(null);
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitShot, setResubmitShot] = useState(null);
  const [resubmitCaption, setResubmitCaption] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [showAllShots, setShowAllShots] = useState(false);
  const toast = useToast();
  const { openAuth } = useAuthDrawer();

  const openResubmitModal = (notif) => {
    const matchedPending = (pendingPosts || []).find(
      (p) => p.status === "rejected" && (p.id === notif.postId || p.image_url === notif.thumbnail)
    ) || (pendingPosts || []).find((p) => p.status === "rejected");

    setResubmitShot({
      ...notif,
      postId: notif.postId || matchedPending?.id || null,
      thumbnail: notif.thumbnail || matchedPending?.image_url || null,
      caption: notif.caption || matchedPending?.caption || "",
    });
    setResubmitCaption(notif.caption || matchedPending?.caption || "");
    setResubmitModalOpen(true);
  };

  const handleDirectResubmit = async () => {
    if (!resubmitShot || !user) return;
    setResubmitting(true);
    try {
      const res = await authFetch("/api/posts/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingPostId: resubmitShot.postId || null,
          imageUrl: resubmitShot.thumbnail,
          caption: resubmitCaption.trim() || null,
          userId: user.id,
          userEmail: user.email,
          notificationId: resubmitShot.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resubmit shot.");
      }

      toast.success("Shot resubmitted for approval! ✨");
      setResubmitModalOpen(false);
      setResubmitShot(null);
      await loadData(user.id);
      notifyNavbar(user.id);
    } catch (err) {
      toast.error(err.message || "Failed to resubmit shot.");
    } finally {
      setResubmitting(false);
    }
  };

  // Load all notification data from API & Supabase
  const loadData = useCallback(async (userId) => {
    if (!userId) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    try {
      const res = await authFetch(`/api/notifications?userId=${userId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const normalizedNotifications = (json.notifications || []).map((notif) => {
            if (typeof notif?.message !== "string") return notif;

            try {
              const parsed = JSON.parse(notif.message);
              if (parsed?.type === "room_deleted") {
                return {
                  ...notif,
                  type: "system",
                  title: parsed.roomName ? `Room "${parsed.roomName}" removed` : "Room removed",
                  subtitle: parsed.text || `The room "${parsed.roomName || "this room"}" was deleted.`,
                };
              }
            } catch (e) {}

            return notif;
          });

          setNotifications(normalizedNotifications);
          setPublishedPosts(json.publishedPosts || []);
          setPendingPosts(json.pendingPosts || []);
          setFilterCounts(json.filterCounts || {});
          setQuickStats(json.quickStats || {});
          setUnreadCount(json.unreadCount || 0);
          setDataLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("API notifications fallback to direct query:", e);
    }

    // Direct fallback
    try {
      const [notifRes, postsRes, pendingRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("pending_posts")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      const notifs = notifRes.data || [];
      const posts = postsRes.data || [];
      const pending = pendingRes.data || [];

      setNotifications(notifs);
      setPublishedPosts(posts);
      setPendingPosts(pending);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Direct query error:", err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Initial authentication check
  useEffect(() => {
    let ignore = false;
    async function init(providedUser = null) {
      const u = providedUser || (await getAuthUser());
      if (!ignore) {
        setUser(u);
        setLoading(false);
        if (u) {
          loadData(u.id);
        } else {
          setDataLoading(false);
        }
      }
    }
    init();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        init(session.user);
      } else {
        init();
      }
    });

    return () => {
      ignore = true;
      authSub?.subscription?.unsubscribe();
    };
  }, [loadData]);

  // Real-time synchronization
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`shotzi-notifications-feed-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          loadData(user.id);
          if (payload.eventType === "INSERT" && payload.new?.message) {
            toast.info(payload.new.message);
          }
          notifyNavbar(user.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_posts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadData(user.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadData(user.id);
        }
      )
      .subscribe();

    const handleLocalUpdate = (e) => {
      const payload = e?.detail || {};
      if (!payload.userId || payload.userId === user.id) {
        loadData(user.id);
      }
    };

    const handleStorageUpdate = (e) => {
      if (e?.key === "shotzi_notification_update") {
        try {
          const payload = JSON.parse(e.newValue || "{}");
          if (!payload.userId || payload.userId === user.id) {
            loadData(user.id);
          }
        } catch (err) {}
      }
    };

    window.addEventListener("shotzi_notification_update_local", handleLocalUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      channel.unsubscribe();
      window.removeEventListener("shotzi_notification_update_local", handleLocalUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [user, loadData, toast]);

  // Dispatch local notification update to keep Navbar in sync
  const notifyNavbar = (userId) => {
    try {
      if (typeof window !== "undefined" && userId) {
        localStorage.setItem(
          "shotzi_notification_update",
          JSON.stringify({ userId, ts: Date.now() })
        );
        window.dispatchEvent(
          new CustomEvent("shotzi_notification_update_local", {
            detail: { userId, ts: Date.now() },
          })
        );
      }
    } catch (e) {}
  };

  // Mark single notification as read
  const markAsRead = async (id) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      await authFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      await supabase.from("notifications").update({ read: true }).eq("id", id);
      notifyNavbar(user?.id);
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);

      await authFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, userId: user.id }),
      });

      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      notifyNavbar(user.id);
      toast.success("All notifications marked as read.");
    } catch (err) {
      toast.error("Failed to mark all as read.");
    }
  };

  // Handle action click on notification (e.g. View Shot)
  const handleActionClick = (notif) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }

    if (notif.type === "approval" || notif.type === "comment" || notif.type === "like") {
      if (notif.postId) {
        router.push(`/post/${notif.postId}`);
      } else {
        router.push("/profile");
      }
    } else if (notif.type === "rejection") {
      router.push("/upload");
    } else if (notif.type === "system") {
      router.push("/upload");
    }
  };

  // Handle responding to room invitation (accept/decline)
  const handleRespondInvite = async (notif, decision) => {
    if (!user || !notif.roomId) return;
    try {
      if (!notif.read) {
        markAsRead(notif.id);
      }
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond_invite",
          roomId: notif.roomId,
          userId: user.id,
          decision,
          notificationId: notif.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${decision} invitation`);
      }

      if (decision === "accept") {
        toast.success(`You joined "${notif.roomName || "the room"}"! 🎉`);
        // Update local notification state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, inviteStatus: "accepted", read: true } : n
          )
        );
        // Direct navigate to the exact room joined
        const roomTarget = notif.roomId ? `/chat/global?room=${encodeURIComponent(notif.roomId)}` : "/chat/global";
        router.push(roomTarget);
      } else {
        toast.info(`Declined invitation to "${notif.roomName || "the room"}".`);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, inviteStatus: "declined", read: true } : n
          )
        );
      }
      notifyNavbar(user.id);
    } catch (err) {
      toast.error(err.message || "Failed to process invitation response.");
    }
  };

  // Filtered notifications list
  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return notifications;
    if (activeFilter === "pending") return notifications.filter((n) => n.type === "pending" || n.status === "pending");
    if (activeFilter === "approvals") return notifications.filter((n) => n.type === "approval");
    if (activeFilter === "rejections") return notifications.filter((n) => n.type === "rejection");
    if (activeFilter === "comments") return notifications.filter((n) => n.type === "comment");
    if (activeFilter === "likes") return notifications.filter((n) => n.type === "like");
    if (activeFilter === "invites") return notifications.filter((n) => n.type === "room_invite");
    if (activeFilter === "system") return notifications.filter((n) => n.type === "system");
    return notifications;
  }, [notifications, activeFilter]);

  // Format relative time helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
        .replace("about ", "")
        .replace("almost ", "");
    } catch {
      return "";
    }
  };

  // Format shot date helper
  const formatShotDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-3 border-black border-t-[#FFD21E] rounded-full animate-spin mb-4" />
        <p className="font-serif text-2xl text-ink font-normal">Loading notifications...</p>
      </div>
    );
  }

  // Unauthenticated view
  if (!user) {
    return (
      <AuthBarrier
        title="Activity & Notifications"
        subtitle="Sign in to track moderation reviews, community reactions, comments on your moments, and room invites."
        badge="MEMBERS ONLY • NOTIFICATIONS"
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-20 space-y-8 font-sans">
      {/* 1. PAGE HERO (With responsive Mark all read action) */}
      <div className="flex items-start justify-between gap-3 pt-2 relative">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-black font-normal tracking-tight">
              Notifications
            </h1>
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5376] mt-1 shrink-0" />
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 font-normal">
            Stay updated on your shots, approvals, and community interactions.
          </p>
        </div>

        {/* Mark All As Read */}
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full border-2 border-black bg-white hover:bg-zinc-50 text-xs font-bold text-black shadow-[2px_2px_0px_#18181B] transition-all shrink-0 active:scale-95 cursor-pointer mt-1"
            title="Mark all notifications as read"
          >
            <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 shrink-0" />
            <span className="hidden xs:inline">Mark all read</span>
            <span className="xs:hidden">Mark read</span>
          </button>
        )}
      </div>

      {/* 2. NOTIFICATION FILTERS (100% visible, natural wrap, zero hidden buttons) */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 border-b border-black/10 pb-3">
        {/* All */}
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            activeFilter === "all"
              ? "bg-[#18181B] text-white shadow-xs"
              : "bg-white text-zinc-700 hover:bg-zinc-100 border border-black/15"
          }`}
        >
          <Bell className="w-3.5 h-3.5 shrink-0" />
          <span>All</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#FF5376] text-white text-[10px] font-black">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Pending */}
        {filterCounts.pending > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("pending")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === "pending"
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-100 border border-black/15"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Pending</span>
            <span className="text-[11px] font-mono text-zinc-500">{filterCounts.pending}</span>
          </button>
        )}

        {/* Approvals */}
        {filterCounts.approvals > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("approvals")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === "approvals"
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-100 border border-black/15"
            }`}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-black shrink-0">
              ✓
            </span>
            <span>Approvals</span>
            <span className="text-[11px] font-mono text-zinc-500">{filterCounts.approvals}</span>
          </button>
        )}

        {/* Rejections */}
        {filterCounts.rejections > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("rejections")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === "rejections"
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-100 border border-black/15"
            }`}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[9px] font-black shrink-0">
              ✕
            </span>
            <span>Rejections</span>
            <span className="text-[11px] font-mono text-zinc-500">{filterCounts.rejections}</span>
          </button>
        )}

        {/* Comments */}
        {filterCounts.comments > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("comments")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === "comments"
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-100 border border-black/15"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Comments</span>
            <span className="text-[11px] font-mono text-zinc-500">{filterCounts.comments}</span>
          </button>
        )}

        {/* Likes */}
        {filterCounts.likes > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("likes")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === "likes"
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-100 border border-black/15"
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>Likes</span>
            <span className="text-[11px] font-mono text-zinc-500">{filterCounts.likes}</span>
          </button>
        )}

        {/* Room Invites */}
        {filterCounts.invites > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("invites")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === "invites"
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-100 border border-black/15"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span>Invites</span>
            <span className="text-[11px] font-mono text-zinc-500">{filterCounts.invites}</span>
          </button>
        )}

        {/* System */}
        {filterCounts.system > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("system")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === "system"
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-100 border border-black/15"
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>System</span>
            <span className="text-[11px] font-mono text-zinc-500">{filterCounts.system}</span>
          </button>
        )}
      </div>

      {/* 3. TWO-COLUMN MAIN SECTION (Notifications Feed + Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* LEFT COLUMN: Notification Cards Feed (70% width) */}
        <div className="lg:col-span-8 space-y-2.5 sm:space-y-3">
          {dataLoading && notifications.length === 0 ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl p-3 sm:p-3.5 border border-black/10 bg-white animate-pulse flex items-start gap-3 shadow-xs"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-200 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3.5 bg-zinc-200 rounded w-1/3" />
                    <div className="h-3 bg-zinc-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-2xl border-2 border-black/10 bg-white space-y-1">
              <p className="font-serif text-xl text-ink font-normal">No notifications yet.</p>
              <p className="text-xs text-zinc-500">You&apos;re all caught up.</p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isUnread = !n.read;
              const time = formatTimeAgo(n.created_at);

              // 0. Pending for Approval Card
              if (n.type === "pending" || n.status === "pending") {
                return (
                  <div
                    key={n.id}
                    className="rounded-2xl p-3 sm:p-3.5 border-2 border-amber-300 bg-amber-50/60 transition-all flex items-start gap-2.5 sm:gap-3.5 shadow-xs"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#FFD21E] text-black border border-black flex items-center justify-center shrink-0 shadow-xs">
                      <Clock className="w-4 h-4 stroke-[2.5] shrink-0" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate leading-snug">
                            {n.title || "Shot Pending Approval"}
                          </h3>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-900 bg-amber-200 border border-amber-400 px-1.5 py-0.2 rounded-full shrink-0">
                            Reviewing
                          </span>
                        </div>
                        {time && <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap shrink-0">{time}</span>}
                      </div>

                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed break-words">
                        {n.subtitle || `Your photo "${n.caption || "shot"}" is awaiting review by admin.`}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {n.thumbnail && (
                          <img
                            src={n.thumbnail}
                            alt=""
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-black/20 shrink-0 shadow-xs"
                          />
                        )}
                        <span className="ml-auto px-2.5 py-0.5 rounded-full border border-amber-400 bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0">
                          Awaiting Admin
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // 1. Approval Card
              if (n.type === "approval") {
                return (
                  <div
                    key={n.id}
                    className={`rounded-2xl p-3 sm:p-3.5 border transition-all flex items-start gap-2.5 sm:gap-3.5 ${
                      isUnread
                        ? "bg-[#F0FDF4] border-emerald-300 shadow-xs"
                        : "bg-[#F7FCF9] border-emerald-100"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-4 h-4 stroke-[3] shrink-0" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate leading-snug">
                            {n.title || "Your shot has been approved!"}
                          </h3>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </div>
                        {time && <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap shrink-0">{time}</span>}
                      </div>

                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed break-words">
                        {n.subtitle}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {n.thumbnail && (
                          <img
                            src={n.thumbnail}
                            alt=""
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-black/15 shrink-0 shadow-xs"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleActionClick(n)}
                          className="ml-auto px-3 py-1 rounded-full border border-black/60 bg-white hover:bg-zinc-50 text-[11px] sm:text-xs font-bold text-black shadow-xs transition-all shrink-0 cursor-pointer"
                        >
                          View Shot
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // 2. Rejection Card
              if (n.type === "rejection") {
                return (
                  <div
                    key={n.id}
                    className={`rounded-2xl p-3 sm:p-3.5 border transition-all flex items-start gap-2.5 sm:gap-3.5 ${
                      isUnread
                        ? "bg-[#FEF2F2] border-rose-300 shadow-xs"
                        : "bg-[#FFF8F8] border-rose-100"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#EF4444] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <X className="w-4 h-4 stroke-[3] shrink-0" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate leading-snug">
                            {n.title || "Your shot wasn't approved"}
                          </h3>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          )}
                        </div>
                        {time && <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap shrink-0">{time}</span>}
                      </div>

                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed break-words">
                        {n.subtitle}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {n.thumbnail && (
                          <img
                            src={n.thumbnail}
                            alt=""
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-black/15 shrink-0 shadow-xs"
                          />
                        )}
                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRejection(n);
                              setGuidelinesModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-full border border-black/40 bg-white hover:bg-zinc-50 text-[11px] font-medium text-black shadow-xs transition-all shrink-0 cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openResubmitModal(n)}
                            className="px-3 py-1 rounded-full bg-[#FF5376] hover:bg-[#E84366] text-white text-[11px] font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <RotateCcw className="w-3 h-3 shrink-0" />
                            <span>Resubmit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // 3. Comment Card
              if (n.type === "comment") {
                return (
                  <div
                    key={n.id}
                    className={`rounded-2xl p-3 sm:p-3.5 border transition-all flex items-start gap-2.5 sm:gap-3.5 bg-white ${
                      isUnread ? "border-indigo-300 shadow-xs" : "border-black/10"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center shrink-0 border border-indigo-100">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate leading-snug">
                            {n.title || "New comment on your shot"}
                          </h3>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                          )}
                        </div>
                        {time && <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap shrink-0">{time}</span>}
                      </div>

                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed break-words">
                        {n.subtitle}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {n.thumbnail && (
                          <img
                            src={n.thumbnail}
                            alt=""
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-black/15 shrink-0 shadow-xs"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleActionClick(n)}
                          className="ml-auto px-3 py-1 rounded-full border border-black/60 bg-white hover:bg-zinc-50 text-[11px] sm:text-xs font-bold text-black shadow-xs transition-all shrink-0 cursor-pointer"
                        >
                          View Comment
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // 4. Like Card
              if (n.type === "like") {
                return (
                  <div
                    key={n.id}
                    className={`rounded-2xl p-3 sm:p-3.5 border transition-all flex items-start gap-2.5 sm:gap-3.5 bg-white ${
                      isUnread ? "border-rose-300 shadow-xs" : "border-black/10"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#FFF1F2] text-[#F43F5E] flex items-center justify-center shrink-0 border border-rose-100">
                      <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate leading-snug">
                            {n.title || "Your shot got a like!"}
                          </h3>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          )}
                        </div>
                        {time && <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap shrink-0">{time}</span>}
                      </div>

                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed break-words">
                        {n.subtitle}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {n.thumbnail && (
                          <img
                            src={n.thumbnail}
                            alt=""
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-black/15 shrink-0 shadow-xs"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleActionClick(n)}
                          className="ml-auto px-3 py-1 rounded-full border border-black/60 bg-white hover:bg-zinc-50 text-[11px] sm:text-xs font-bold text-black shadow-xs transition-all shrink-0 cursor-pointer"
                        >
                          View Shot
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // 4.5 Room Invitation Card
              if (n.type === "room_invite") {
                const isAccepted = n.inviteStatus === "accepted";
                const isDeclined = n.inviteStatus === "declined";

                return (
                  <div
                    key={n.id}
                    className={`rounded-2xl p-3 sm:p-3.5 border transition-all flex items-start gap-2.5 sm:gap-3.5 ${
                      isAccepted
                        ? "bg-emerald-50/70 border-emerald-300"
                        : isDeclined
                        ? "bg-zinc-50 border-zinc-200 opacity-65"
                        : isUnread
                        ? "bg-sky-50/80 border-sky-300 shadow-xs"
                        : "bg-white border-black/15 shadow-xs"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0 shadow-xs">
                      <Users className="w-4 h-4 stroke-[2.5] shrink-0" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate leading-snug">
                            {n.title || `Invited to #${n.roomName || "room"}`}
                          </h3>
                          {isAccepted && (
                            <span className="inline-flex items-center text-[9px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-full shrink-0">
                              ✓ Joined
                            </span>
                          )}
                          {isDeclined && (
                            <span className="inline-flex items-center text-[9px] font-bold text-zinc-600 bg-zinc-200 px-1.5 py-0.2 rounded-full shrink-0">
                              Declined
                            </span>
                          )}
                        </div>
                        {time && <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap shrink-0">{time}</span>}
                      </div>

                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed break-words">
                        {n.subtitle || `@${n.creatorUsername || "A curator"} invited you to join this community corner.`}
                      </p>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        {isAccepted ? (
                          <Link
                            href={
                              (n.roomId || n.roomInviteData?.roomId)
                                ? `/chat/global?room=${encodeURIComponent(n.roomId || n.roomInviteData?.roomId)}`
                                : "/chat/global"
                            }
                            className="px-3 py-1 rounded-full bg-[#18181B] text-white hover:bg-black text-[11px] sm:text-xs font-bold shadow-xs transition-all inline-flex items-center gap-1 shrink-0"
                          >
                            <span>Go to Room</span>
                            <ArrowRight className="w-3 h-3 shrink-0" />
                          </Link>
                        ) : isDeclined ? (
                          <span className="text-[11px] text-zinc-500 font-medium px-2 py-0.5 shrink-0">
                            Declined
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRespondInvite(n, "decline")}
                              className="px-2.5 py-1 rounded-full border border-black/20 bg-white hover:bg-zinc-100 text-[11px] font-bold text-zinc-700 shadow-xs transition-all cursor-pointer shrink-0"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRespondInvite(n, "accept")}
                              className="px-3 py-1 rounded-full bg-[#10B981] hover:bg-[#059669] text-white text-[11px] font-black shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Check className="w-3 h-3 stroke-[3] shrink-0" />
                              <span>Join</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // 5. System Card
              return (
                <div
                  key={n.id}
                  className={`rounded-2xl p-3 sm:p-3.5 border transition-all flex items-start gap-2.5 sm:gap-3.5 bg-white ${
                    isUnread ? "border-amber-300 shadow-xs" : "border-black/10"
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0 border border-zinc-200">
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate leading-snug">
                          {n.title || "Welcome to Shotzi!"}
                        </h3>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-zinc-700 shrink-0" />
                        )}
                      </div>
                      {time && <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap shrink-0">{time}</span>}
                    </div>

                    <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed break-words">
                      {n.subtitle}
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => router.push("/upload")}
                        className="ml-auto px-3 py-1 rounded-full border border-black/60 bg-white hover:bg-zinc-50 text-[11px] sm:text-xs font-bold text-black shadow-xs transition-all inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <span>Start Dumping</span>
                        <ArrowRight className="w-3 h-3 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: Sidebar Cards */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Quick Stats (Live calculated directly from database) */}
          <div className="bg-white rounded-2xl p-5 border border-black/10 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 pb-1">
              <BarChart3 className="w-4 h-4 text-zinc-600" />
              <h3 className="font-bold text-sm text-zinc-900">Quick Stats</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Published shots */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <span className="font-bold text-zinc-900">{quickStats.publishedShots}</span>
                </div>
                <span className="text-zinc-600">Published Shots</span>
              </div>

              {/* Pending shots */}
              {quickStats.pendingShots > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold">
                      ⏳
                    </span>
                    <span className="font-bold text-zinc-900">{quickStats.pendingShots}</span>
                  </div>
                  <span className="text-zinc-600">Pending Review</span>
                </div>
              )}

              {/* Rejected shots */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold">
                    ✕
                  </span>
                  <span className="font-bold text-zinc-900">{quickStats.rejectedShots}</span>
                </div>
                <span className="text-zinc-600">Rejected Shots</span>
              </div>

              {/* Comments */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
                    💬
                  </span>
                  <span className="font-bold text-zinc-900">{quickStats.newComments}</span>
                </div>
                <span className="text-zinc-600">New Comments</span>
              </div>

              {/* Likes */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px]">
                    ♡
                  </span>
                  <span className="font-bold text-zinc-900">{quickStats.totalLikes}</span>
                </div>
                <span className="text-zinc-600">Total Likes</span>
              </div>
            </div>
          </div>

          {/* Card 2: Tip Banner */}
          <div className="bg-[#FEF9E6] rounded-2xl p-4.5 border border-amber-200/70 shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
              <span>💡 Tip</span>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-relaxed font-normal">
              If your shot was rejected, read the guidelines and try a different edit. You got this! 💛
            </p>
          </div>
        </div>
      </div>

      {/* 4. PUBLISHED SHOTS SECTION (Compact, Scalable, Multi-column) */}
      <div className="space-y-3 pt-6 border-t border-black/10">
        <div className="flex items-center justify-between relative pb-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFD21E] shrink-0" />
            <h2 className="font-serif text-xl xs:text-2xl sm:text-3xl font-normal text-zinc-900 truncate">
              <span className="xs:hidden">Shots</span>
              <span className="hidden xs:inline">Published Shots</span>
            </h2>
            <span className="text-[11px] font-mono font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full border border-black/10 shrink-0">
              {publishedPosts.length}
            </span>
          </div>

          {/* Hand-drawn scribble arrow matching reference */}
          <div className="hidden lg:block absolute left-80 -top-3 pointer-events-none select-none">
            <img
              src="/decor/visual_diary_arrow.png"
              alt="your visual diary <3"
              className="h-9 w-auto object-contain"
            />
          </div>

          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-black/20 bg-white hover:bg-[#FFD21E] text-xs font-bold text-zinc-800 shadow-xs transition-all shrink-0 whitespace-nowrap"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {publishedPosts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-black/10 text-center space-y-2 shadow-xs">
            <Camera className="w-7 h-7 mx-auto text-zinc-400" />
            <p className="font-serif text-xl text-ink font-normal">No published shots yet.</p>
            <p className="text-xs text-zinc-500">
              When an admin approves your uploaded dump, it will appear here live.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 xs:gap-3 sm:gap-4">
              {(showAllShots ? publishedPosts : publishedPosts.slice(0, 6)).map((p) => (
                <Link
                  key={p.id}
                  href={`/post/${p.id}`}
                  className="group rounded-xl sm:rounded-2xl overflow-hidden bg-white border border-black/15 shadow-[1.5px_1.5px_0px_#18181B] sm:shadow-[2px_2px_0px_#18181B] hover:shadow-[3.5px_3.5px_0px_#18181B] hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                >
                  {/* Photo container - compact square aspect ratio */}
                  <div className="aspect-square w-full overflow-hidden bg-zinc-100 relative">
                    <img
                      src={p.image_url}
                      alt={p.caption || "Published Shot"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {/* Live indicator overlay */}
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 flex items-center gap-1 text-[9px] font-bold text-white shadow-xs pointer-events-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                      <span className="hidden xs:inline">Live</span>
                    </div>
                  </div>

                  {/* Compact footer details */}
                  <div className="p-2 xs:p-2.5 flex flex-col gap-1 bg-white flex-1 justify-between">
                    <p className="text-[11px] sm:text-xs font-bold text-zinc-900 truncate" title={p.caption || "Untitled"}>
                      {p.caption || "Untitled"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-100">
                      <span className="font-mono text-zinc-400 text-[9px] xs:text-[10px] truncate">
                        {formatShotDate(p.created_at)}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-0.5 text-zinc-600 text-[10px] font-mono" title={`${p.likeCount || 0} likes`}>
                          <Heart className="w-2.5 h-2.5 text-zinc-400 fill-zinc-100" />
                          <span>{p.likeCount || 0}</span>
                        </span>

                        <span className="inline-flex items-center gap-0.5 text-zinc-600 text-[10px] font-mono" title={`${p.commentCount || 0} comments`}>
                          <MessageSquare className="w-2.5 h-2.5 text-zinc-400" />
                          <span>{p.commentCount || 0}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Scalability toggle button if user has more than 6 shots */}
            {publishedPosts.length > 6 && (
              <div className="flex items-center justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllShots((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-black/20 bg-white hover:bg-[#FFD21E] text-xs font-black text-zinc-800 shadow-[1.5px_1.5px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  <span>
                    {showAllShots
                      ? `Show fewer (6 of ${publishedPosts.length})`
                      : `Show all ${publishedPosts.length} shots (${publishedPosts.length - 6} more)`}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      showAllShots ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* GUIDELINES MODAL (Triggered on 'Learn More') */}
      {guidelinesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border-2 border-black rounded-3xl p-6 max-w-md w-full shadow-[6px_6px_0px_#18181B] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-base text-zinc-900">Community Guidelines</h3>
              </div>
              <button
                type="button"
                onClick={() => setGuidelinesModalOpen(false)}
                className="p-1 rounded-full hover:bg-zinc-100 text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-600 leading-relaxed">
              <p>
                Shotzi is a candid, cozy space for real feelings. Photos submitted for moderation are
                reviewed to ensure:
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-700 font-medium">
                <li>Originality: Dump authentic, raw, unedited camera roll captures.</li>
                <li>Respect: No hate speech, harassment, or explicit material.</li>
                <li>Clarity: Avoid broken, corrupted or heavily compressed duplicates.</li>
              </ul>
              <p className="text-[11px] text-zinc-500 pt-1">
                You can always edit your shot or caption and resubmit for review.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGuidelinesModalOpen(false)}
                className="px-4 py-2 rounded-full border border-black/20 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuidelinesModalOpen(false);
                  if (selectedRejection) {
                    openResubmitModal(selectedRejection);
                  } else {
                    router.push("/upload");
                  }
                }}
                className="neo-btn neo-btn-yellow px-5 py-2 text-xs font-bold shadow-[2px_2px_0px_#18181B] flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resubmit Shot</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Direct Resubmit Shot Modal */}
      {resubmitModalOpen && resubmitShot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-3xl p-6 max-w-lg w-full shadow-[6px_6px_0px_#18181B] space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFD21E] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_#18181B]">
                  <RotateCcw className="w-4 h-4 text-black" />
                </div>
                <div>
                  <h3 className="font-serif text-xl sm:text-2xl text-black font-normal leading-tight">
                    Resubmit Shot
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    Your rejected image is saved. Keep or edit your caption below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="w-8 h-8 rounded-full border border-black/20 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preserved Image Preview */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-black bg-zinc-950 max-h-56 flex items-center justify-center shadow-[2px_2px_0px_#18181B]">
              {resubmitShot.thumbnail ? (
                <img
                  src={resubmitShot.thumbnail}
                  alt="Shot preview"
                  className="max-h-56 w-full object-contain bg-zinc-900"
                />
              ) : (
                <div className="py-12 text-zinc-400 text-xs font-bold">
                  Image preserved in storage
                </div>
              )}
              <div className="absolute bottom-2.5 left-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1.5 shadow-xs">
                <Camera className="w-3 h-3 text-[#FFD21E]" />
                <span>Saved Camera Roll Shot</span>
              </div>
            </div>

            {/* Caption Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-zinc-800">
                  Caption & Description
                </label>
                {resubmitShot.caption && resubmitCaption !== resubmitShot.caption && (
                  <button
                    type="button"
                    onClick={() => setResubmitCaption(resubmitShot.caption)}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                  >
                    ↺ Reset to original caption
                  </button>
                )}
              </div>
              <textarea
                value={resubmitCaption}
                onChange={(e) => setResubmitCaption(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Give your shot a cozy caption..."
                className="w-full rounded-2xl border-2 border-black p-3.5 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD21E] bg-[#FAFAFA] resize-none shadow-[1.5px_1.5px_0px_#18181B]"
              />
              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
                <span>Keep original or refine your caption for review.</span>
                <span className="font-bold">{resubmitCaption.length} / 280</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/10">
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="px-4 py-2 rounded-full border border-black/20 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDirectResubmit}
                disabled={resubmitting}
                className="neo-btn neo-btn-yellow px-5 py-2 text-xs font-black shadow-[2px_2px_0px_#18181B] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {resubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Resubmitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Resubmit for Approval</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
