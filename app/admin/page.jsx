"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAdmin } from "../../lib/admin";
import { executeAdminDelete } from "../../lib/adminService";
import { supabase, getAuthUser } from "../../lib/supabaseClient";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { authFetch } from "../../lib/apiClient";
import {
  Shield,
  Clock,
  ImageIcon,
  Users,
  Search,
  Check,
  X,
  Trash2,
  ExternalLink,
  AlertTriangle,
  UserX,
  MessageSquare,
  Crown,
  Key,
} from "lucide-react";

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "live" | "users" | "rooms"
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Data states
  const [pendingPosts, setPendingPosts] = useState([]);
  const [livePosts, setLivePosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Search filters
  const [liveSearch, setLiveSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");

  // Action busy states
  const [busyId, setBusyId] = useState(null);

  // Dialog State
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmWord: "",
    action: null,
  });

  useEffect(() => {
    let ignore = false;
    async function load(providedUser = null) {
      let u = providedUser;
      if (!u) {
        u = await getAuthUser();
      }
      if (!ignore) {
        setUser(u);
        if (isAdmin(u)) {
          await Promise.all([loadPending(), loadLivePosts(), loadUsers(), loadRooms()]);
        }
        setLoading(false);
      }
    }
    load();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        load(session.user);
      } else {
        load();
      }
    });

    return () => {
      ignore = true;
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  const loadRooms = async () => {
    try {
      const res = await authFetch("/api/chat/rooms", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setRooms(json.rooms || []);
      }
    } catch (e) {
      console.warn("Failed to load rooms in admin:", e);
    }
  };

  const loadPending = async () => {
    const { data } = await supabase
      .from("pending_posts")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingPosts(data || []);
  };

  const loadLivePosts = async () => {
    const { data: posts } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    const userIds = [...new Set((posts || []).map((p) => p.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, username, display_name").in("id", userIds)
      : { data: [] };

    const merged = (posts || []).map((p) => ({
      ...p,
      profile_username:
        profiles?.find((x) => x.id === p.user_id)?.username ||
        p.user_email?.split("@")[0] ||
        "user",
    }));

    setLivePosts(merged);
  };

  const loadUsers = async () => {
    const [{ data: profiles }, { data: allPosts }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("posts").select("id, user_id, user_email"),
    ]);

    const postCounts = {};
    const postEmails = {};
    (allPosts || []).forEach((p) => {
      postCounts[p.user_id] = (postCounts[p.user_id] || 0) + 1;
      if (p.user_email) postEmails[p.user_id] = p.user_email;
    });

    const knownIds = new Set((profiles || []).map((p) => p.id));
    const virtualUsers = [];

    (allPosts || []).forEach((p) => {
      if (!knownIds.has(p.user_id)) {
        knownIds.add(p.user_id);
        virtualUsers.push({
          id: p.user_id,
          username: p.user_email ? p.user_email.split("@")[0] : `user_${p.user_id.slice(0, 6)}`,
          display_name: p.user_email ? p.user_email.split("@")[0] : `user_${p.user_id.slice(0, 6)}`,
          bio: "",
          avatar_url: null,
          created_at: null,
          post_count: 0,
          email: p.user_email || null,
        });
      }
    });

    const combined = [...(profiles || []), ...virtualUsers].map((u) => ({
      ...u,
      post_count: postCounts[u.id] || 0,
      email: u.email || postEmails[u.id] || "No email",
    }));

    setUsers(combined);
  };

  // Moderation Actions
  const approvePost = async (post) => {
    try {
      setBusyId(post.id);
      const { error: insertErr } = await supabase.from("posts").insert({
        image_url: post.image_url,
        caption: post.caption,
        user_id: post.user_id,
        user_email: post.user_email,
      });
      if (insertErr) throw insertErr;

      await supabase.from("pending_posts").update({ status: "approved" }).eq("id", post.id);

      try {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          message: "Your post has been approved and published to Shotzi!",
          read: false,
        });
      } catch (e) {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: post.user_id,
            message: "Your post has been approved and published to Shotzi!",
          }),
        }).catch(() => null);
      }

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "shotzi_notification_update",
            JSON.stringify({ userId: post.user_id, ts: Date.now() })
          );
          window.dispatchEvent(
            new CustomEvent("shotzi_notification_update_local", {
              detail: { userId: post.user_id, ts: Date.now() },
            })
          );
        }
      } catch (err) {}

      setPendingPosts((prev) => prev.filter((p) => p.id !== post.id));
      await loadLivePosts();
      toast.success("Post approved and published.");
    } catch (err) {
      toast.error("Failed to approve post: " + err.message);
    } finally {
      setBusyId(null);
    }
  };

  const rejectPost = async (post) => {
    try {
      setBusyId(post.id);
      await supabase.from("pending_posts").update({ status: "rejected" }).eq("id", post.id);

      try {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          message: "Your post did not meet community guidelines and was rejected.",
          read: false,
        });
      } catch (e) {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: post.user_id,
            message: "Your post did not meet community guidelines and was rejected.",
          }),
        }).catch(() => null);
      }

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "shotzi_notification_update",
            JSON.stringify({ userId: post.user_id, ts: Date.now() })
          );
          window.dispatchEvent(
            new CustomEvent("shotzi_notification_update_local", {
              detail: { userId: post.user_id, ts: Date.now() },
            })
          );
        }
      } catch (err) {}

      setPendingPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.info("Post rejected.");
    } catch (err) {
      toast.error("Failed to reject post: " + err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePost = (postId) => {
    const postToDelete = livePosts.find((p) => p.id === postId);
    setConfirmState({
      isOpen: true,
      title: "Admin: Delete Live Post",
      description: "Permanently purge this post from database, storage and feed.",
      confirmWord: "",
      action: async () => {
        const res = await executeAdminDelete("delete_post", { postId });
        if (res.success) {
          setLivePosts((prev) => prev.filter((p) => p.id !== postId));
          if (postToDelete?.user_id) {
            try {
              await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user_id: postToDelete.user_id,
                  message: `Moderation notice: Your shot "${postToDelete.caption || "Untitled"}" was removed by admin.`,
                }),
              });
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("shotzi_notification_update_local", {
                    detail: { userId: postToDelete.user_id, ts: Date.now() },
                  })
                );
              }
            } catch (e) {}
          }
          toast.success("Post deleted from database.");
        } else {
          toast.error(res.error || "Failed to delete post.");
        }
      },
    });
  };

  const handleDeleteUserPosts = (userId, username) => {
    setConfirmState({
      isOpen: true,
      title: `Delete All Posts by @${username}?`,
      description: `This will permanently remove every post published by @${username}.`,
      confirmWord: "DELETE",
      action: async () => {
        const res = await executeAdminDelete("delete_user_posts", { userId });
        if (res.success) {
          setLivePosts((prev) => prev.filter((p) => p.user_id !== userId));
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, post_count: 0 } : u))
          );
          toast.success(`All posts by @${username} removed.`);
        } else {
          toast.error(res.error || "Failed to delete user posts.");
        }
      },
    });
  };

  const handleDeleteUserExistence = (userId, username) => {
    setConfirmState({
      isOpen: true,
      title: `Delete @${username} From Existence?`,
      description: `Permanent wipe: Removes @${username} and all their posts, comments, likes, messages, notifications, and profile.`,
      confirmWord: "DELETE",
      action: async () => {
        const res = await executeAdminDelete("delete_user", { userId });
        if (res.success) {
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          setLivePosts((prev) => prev.filter((p) => p.user_id !== userId));
          setPendingPosts((prev) => prev.filter((p) => p.user_id !== userId));
          toast.success(`User @${username} has been completely removed.`);
        } else {
          toast.error(res.error || "Failed to delete user.");
        }
      },
    });
  };

  const handleDeleteRoom = (room) => {
    setConfirmState({
      isOpen: true,
      title: `Admin: Delete Room "${room.name}"?`,
      description: `Permanent wipe: Removes this chat room, its membership logs, and purges all chat messages sent in it.`,
      confirmWord: "",
      action: async () => {
        const res = await executeAdminDelete("delete_room", { roomId: room.id });
        if (res.success) {
          setRooms((prev) => prev.filter((r) => r.id !== room.id));
          toast.success(`Room "${room.name}" has been permanently purged.`);
        } else {
          toast.error(res.error || "Failed to delete room.");
        }
      },
    });
  };

  const handleRemoveRoomMember = async (roomId, targetUserId, memberName) => {
    try {
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_member",
          roomId,
          creatorId: user.id,
          targetUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member.");
      toast.success(`Removed @${memberName} from room.`);
      await loadRooms();
    } catch (err) {
      toast.error(err.message || "Failed to remove member.");
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-[3px] border-black border-t-[#FFD21E] rounded-full animate-spin shadow-[2px_2px_0px_#000]" />
        <p className="font-black text-sm text-black uppercase tracking-wider">Opening Command Center...</p>
      </div>
    );
  }

  if (!user || !isAdmin(user)) {
    return (
      <div className="py-16 max-w-md mx-auto text-center">
        <div className="bg-white border-[2.5px] border-black rounded-3xl p-8 shadow-[6px_6px_0px_#18181B] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FF5376] text-white border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-black tracking-tight">Access Restricted</h2>
          <p className="text-xs text-zinc-600 font-medium">
            {!user
              ? "Please sign in with your verified administrator account to access the Command Center."
              : "The Command Center is strictly reserved for verified community administrators."}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {!user ? (
              <Link
                href="/auth?mode=signin"
                className="neo-btn neo-btn-yellow px-5 py-2.5 text-xs font-black"
              >
                <span>Sign In as Admin</span>
              </Link>
            ) : null}
            <Link
              href="/"
              className="neo-btn neo-btn-white px-5 py-2.5 text-xs font-bold"
            >
              <span>Return to Feed</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredLivePosts = livePosts.filter((p) => {
    const q = liveSearch.toLowerCase();
    return (
      p.caption?.toLowerCase().includes(q) ||
      p.profile_username?.toLowerCase().includes(q) ||
      p.user_email?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  });

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q)
    );
  });

  const filteredRooms = rooms.filter((r) => {
    const q = roomSearch.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q) ||
      r.creator_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-2 sm:px-4 pb-16 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFD21E] text-black border-2 border-black text-xs font-black mb-2 shadow-[2px_2px_0px_#18181B]">
            <Shield className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>MODERATOR HEADQUARTERS</span>
          </div>
          <h1 className="font-black text-3xl sm:text-4xl text-black tracking-tight">
            Shotzi Command Center
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 font-medium mt-1">
            Keep the community vibrant, unfiltered, and thoughtfully moderated.
          </p>
        </div>
      </div>

      {/* STAT CARDS - Neo-Brutalist 4-Pack */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`p-4 sm:p-5 rounded-3xl border-2 border-black text-left transition-all duration-200 cursor-pointer active:scale-98 ${
            activeTab === "pending"
              ? "bg-[#FFD21E] shadow-[4px_4px_0px_#18181B] -translate-y-1"
              : "bg-white hover:bg-zinc-50 shadow-[2px_2px_0px_#18181B]"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-black uppercase tracking-wider">
              Pending Reviews
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 border-2 border-black flex items-center justify-center text-amber-700 shadow-[1px_1px_0px_#000]">
              <Clock className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <span className="font-black text-3xl sm:text-4xl text-black tracking-tight block">
            {pendingPosts.length}
          </span>
          <p className="text-xs font-bold text-zinc-600 mt-1">Awaiting review</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("live")}
          className={`p-4 sm:p-5 rounded-3xl border-2 border-black text-left transition-all duration-200 cursor-pointer active:scale-98 ${
            activeTab === "live"
              ? "bg-[#FFD21E] shadow-[4px_4px_0px_#18181B] -translate-y-1"
              : "bg-white hover:bg-zinc-50 shadow-[2px_2px_0px_#18181B]"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-black uppercase tracking-wider">
              Published Shots
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border-2 border-black flex items-center justify-center text-emerald-700 shadow-[1px_1px_0px_#000]">
              <ImageIcon className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <span className="font-black text-3xl sm:text-4xl text-black tracking-tight block">
            {livePosts.length}
          </span>
          <p className="text-xs font-bold text-zinc-600 mt-1">Live in community feeds</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`p-4 sm:p-5 rounded-3xl border-2 border-black text-left transition-all duration-200 cursor-pointer active:scale-98 ${
            activeTab === "users"
              ? "bg-[#FFD21E] shadow-[4px_4px_0px_#18181B] -translate-y-1"
              : "bg-white hover:bg-zinc-50 shadow-[2px_2px_0px_#18181B]"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-black uppercase tracking-wider">
              Curators
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 border-2 border-black flex items-center justify-center text-purple-700 shadow-[1px_1px_0px_#000]">
              <Users className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <span className="font-black text-3xl sm:text-4xl text-black tracking-tight block">
            {users.length}
          </span>
          <p className="text-xs font-bold text-zinc-600 mt-1">Registered accounts</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rooms")}
          className={`p-4 sm:p-5 rounded-3xl border-2 border-black text-left transition-all duration-200 cursor-pointer active:scale-98 ${
            activeTab === "rooms"
              ? "bg-[#FFD21E] shadow-[4px_4px_0px_#18181B] -translate-y-1"
              : "bg-white hover:bg-zinc-50 shadow-[2px_2px_0px_#18181B]"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-black uppercase tracking-wider">
              Rooms & Corners
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 border-2 border-black flex items-center justify-center text-sky-700 shadow-[1px_1px_0px_#000]">
              <MessageSquare className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <span className="font-black text-3xl sm:text-4xl text-black tracking-tight block">
            {rooms.length}
          </span>
          <p className="text-xs font-bold text-zinc-600 mt-1">Active chat corners</p>
        </button>
      </div>

      {/* TABS MENU - Neo Pill Strip */}
      <div className="flex items-center gap-2 border-b-2 border-black pb-3 overflow-x-auto soft-scroll">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "pending"
              ? "bg-[#18181B] text-white border-2 border-black shadow-[2px_2px_0px_#FFD21E]"
              : "bg-white text-black border-2 border-black hover:bg-zinc-100 shadow-[1.5px_1.5px_0px_#18181B]"
          }`}
        >
          <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Pending Reviews ({pendingPosts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("live")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "live"
              ? "bg-[#18181B] text-white border-2 border-black shadow-[2px_2px_0px_#FFD21E]"
              : "bg-white text-black border-2 border-black hover:bg-zinc-100 shadow-[1.5px_1.5px_0px_#18181B]"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Live Posts ({livePosts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "users"
              ? "bg-[#18181B] text-white border-2 border-black shadow-[2px_2px_0px_#FFD21E]"
              : "bg-white text-black border-2 border-black hover:bg-zinc-100 shadow-[1.5px_1.5px_0px_#18181B]"
          }`}
        >
          <Users className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Users Directory ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rooms")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "rooms"
              ? "bg-[#18181B] text-white border-2 border-black shadow-[2px_2px_0px_#FFD21E]"
              : "bg-white text-black border-2 border-black hover:bg-zinc-100 shadow-[1.5px_1.5px_0px_#18181B]"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Rooms & Corners ({rooms.length})</span>
        </button>
      </div>

      {/* TAB 1: PENDING POSTS */}
      {activeTab === "pending" && (
        <section className="space-y-4">
          {pendingPosts.length === 0 ? (
            <div className="bg-white border-2 border-black rounded-3xl p-12 text-center max-w-md mx-auto space-y-3 shadow-[4px_4px_0px_#18181B]">
              <div className="w-14 h-14 rounded-2xl bg-[#10B981] text-white border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#18181B]">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <h3 className="font-black text-2xl text-black">All caught up!</h3>
              <p className="text-xs font-bold text-zinc-600">
                There are no pending submissions awaiting review right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {pendingPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white border-2 border-black rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-[4px_4px_0px_#18181B] transition-transform hover:-translate-y-0.5"
                >
                  <div>
                    <div className="aspect-[4/5] rounded-2xl overflow-hidden mb-3 border-2 border-black shadow-[2px_2px_0px_#000] bg-zinc-100">
                      <img
                        src={post.image_url}
                        alt="Pending post"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs sm:text-sm text-black font-bold line-clamp-3 mb-2 leading-snug break-words">
                      {post.caption || <span className="italic text-zinc-400 font-medium">(No caption)</span>}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-600 truncate">
                      From: {post.user_email}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      Submitted: {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-4 mt-3 border-t-2 border-black/10">
                    <button
                      type="button"
                      onClick={() => approvePost(post)}
                      disabled={busyId === post.id}
                      className="flex-1 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectPost(post)}
                      disabled={busyId === post.id}
                      className="flex-1 py-2.5 rounded-xl bg-[#FF5376] hover:bg-rose-600 text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4 stroke-[3]" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: LIVE POSTS */}
      {activeTab === "live" && (
        <section className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={liveSearch}
              onChange={(e) => setLiveSearch(e.target.value)}
              placeholder="Search posts by username, caption, email, or ID..."
              className="w-full h-11 pl-10 pr-4 rounded-2xl border-2 border-black bg-white text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[2px_2px_0px_#18181B]"
            />
          </div>

          {filteredLivePosts.length === 0 ? (
            <div className="bg-white border-2 border-black rounded-3xl p-12 text-center max-w-md mx-auto shadow-[4px_4px_0px_#18181B]">
              <p className="text-xs font-bold text-zinc-600">No live posts matched your filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filteredLivePosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white border-2 border-black rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 flex flex-col justify-between shadow-[3px_3px_0px_#18181B] hover:-translate-y-0.5 transition-transform"
                >
                  <div>
                    <div className="relative aspect-[4/5] rounded-xl overflow-hidden mb-2 border-2 border-black shadow-[1px_1px_0px_#000] bg-zinc-100">
                      <img
                        src={post.image_url}
                        alt="Post"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <Link
                        href={`/post/${post.id}`}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white border-2 border-black text-black hover:bg-[#FFD21E] shadow-[1px_1px_0px_#000] transition-colors"
                        title="View post"
                      >
                        <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                      </Link>
                    </div>

                    <p className="text-[11px] sm:text-xs text-black font-bold line-clamp-2 mb-1 leading-snug break-words">
                      {post.caption || <span className="italic text-zinc-400 font-medium">(No caption)</span>}
                    </p>

                    <Link
                      href={`/u/${post.profile_username}`}
                      className="text-[11px] font-mono text-[#B45309] font-black hover:underline block truncate"
                    >
                      @{post.profile_username}
                    </Link>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t-2 border-black/10 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      className="w-full py-1.5 rounded-xl bg-[#FF5376] hover:bg-rose-600 text-white text-[11px] sm:text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 stroke-[2.5]" />
                      <span>Delete Post</span>
                    </button>
                    {user.id !== post.user_id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUserPosts(post.user_id, post.profile_username)}
                        className="w-full py-1 text-[10px] sm:text-[11px] rounded-xl border border-black/30 hover:bg-zinc-100 text-zinc-700 font-bold transition-colors cursor-pointer truncate"
                      >
                        Delete All by User
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: USERS DIRECTORY */}
      {activeTab === "users" && (
        <section className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by username, display name, email, or ID..."
              className="w-full h-11 pl-10 pr-4 rounded-2xl border-2 border-black bg-white text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[2px_2px_0px_#18181B]"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <div className="bg-white border-2 border-black rounded-3xl p-12 text-center max-w-md mx-auto shadow-[4px_4px_0px_#18181B]">
              <p className="text-xs font-bold text-zinc-600">No curators matched your search.</p>
            </div>
          ) : (
            <div className="bg-white border-2 border-black rounded-3xl overflow-hidden shadow-[4px_4px_0px_#18181B]">
              <div className="overflow-x-auto soft-scroll">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#FAF7F0] text-black font-black uppercase tracking-wider">
                      <th className="p-3.5 sm:p-4 font-black">Curator</th>
                      <th className="p-3.5 sm:p-4 font-black hidden sm:table-cell">Email</th>
                      <th className="p-3.5 sm:p-4 font-black">Shots</th>
                      <th className="p-3.5 sm:p-4 font-black text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black/10">
                    {filteredUsers.map((u) => {
                      const isSelf = user.id === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="p-3.5 sm:p-4">
                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-[#FFD21E] border-2 border-black flex items-center justify-center font-black text-xs text-black shrink-0 overflow-hidden shadow-[1px_1px_0px_#000]">
                                {u.avatar_url ? (
                                  <img
                                    src={u.avatar_url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{u.username?.charAt(0).toUpperCase() || "U"}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  href={`/u/${u.username || u.id}`}
                                  className="font-black text-xs sm:text-sm text-black hover:text-[#B45309] truncate block"
                                >
                                  @{u.username || u.id.slice(0, 8)}
                                </Link>
                                <span className="text-[10px] text-zinc-500 font-mono block truncate max-w-[120px] sm:max-w-none">
                                  {u.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 sm:p-4 text-zinc-600 font-mono truncate max-w-xs hidden sm:table-cell">
                            {u.email}
                          </td>

                          <td className="p-3.5 sm:p-4">
                            <span className="font-mono font-black px-2.5 py-0.5 rounded-full bg-[#FFD21E] border border-black text-black text-[11px] shadow-[1px_1px_0px_#000]">
                              {u.post_count || 0}
                            </span>
                          </td>

                          <td className="p-3.5 sm:p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                              <Link
                                href={`/u/${u.username || u.id}`}
                                className="px-3 py-1 rounded-full border-2 border-black bg-white hover:bg-[#FFD21E] text-xs font-bold text-black shadow-[1px_1px_0px_#000] transition-colors"
                              >
                                Roll
                              </Link>

                              {!isSelf && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUserPosts(u.id, u.username)}
                                    className="px-2.5 py-1 rounded-full border border-rose-300 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition-colors cursor-pointer hidden md:inline-block"
                                  >
                                    Purge
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUserExistence(u.id, u.username)}
                                    className="px-3 py-1 rounded-full bg-[#FF5376] text-white hover:bg-rose-600 text-xs font-black border-2 border-black shadow-[1px_1px_0px_#000] transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <UserX className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span className="hidden sm:inline">Delete</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: ROOMS & CORNERS (Master Admin Control) */}
      {activeTab === "rooms" && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search rooms, descriptions, creators..."
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                className="w-full h-11 pl-10 pr-4 text-xs font-bold rounded-2xl bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#FFD21E] text-black shadow-[2px_2px_0px_#18181B]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600">
                Showing {filteredRooms.length} of {rooms.length} rooms
              </span>
              <Link
                href="/chat"
                className="px-3.5 py-1.5 rounded-full bg-[#FFD21E] border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#18181B] hover:bg-[#ffe169] transition-all inline-flex items-center gap-1.5"
              >
                <span>Open Chat</span>
                <ExternalLink className="w-3 h-3 stroke-[2.5]" />
              </Link>
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="bg-white border-2 border-black rounded-3xl p-12 text-center max-w-md mx-auto space-y-3 shadow-[4px_4px_0px_#18181B]">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                <MessageSquare className="w-7 h-7 text-black" />
              </div>
              <h3 className="font-black text-2xl text-black">No rooms found</h3>
              <p className="text-xs font-bold text-zinc-600">
                {roomSearch ? "Try adjusting your search query." : "No chat corners exist yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRooms.map((room) => {
                const memberCount = room.members?.length || 0;
                const pendingCount = room.pending_requests?.length || 0;
                const invitesCount = room.pending_invites?.length || 0;
                const isDefault = room.id === "corner_dump" || room.id === "coffee_corner";

                return (
                  <div
                    key={room.id}
                    className="bg-white border-2 border-black rounded-3xl p-5 flex flex-col justify-between shadow-[4px_4px_0px_#18181B] hover:-translate-y-0.5 transition-all space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center font-black text-base shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                            #
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-black text-sm sm:text-base text-black truncate">{room.name}</h3>
                              {room.is_private ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-200 border border-amber-400 px-2 py-0.5 rounded-full shrink-0">
                                  <Key className="w-2.5 h-2.5" /> Private
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                                  Public
                                </span>
                              )}
                              {isDefault && (
                                <span className="text-[10px] font-black text-indigo-800 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded-full shrink-0">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 font-medium mt-0.5 line-clamp-2 break-words">
                              {room.description || "No description set"}
                            </p>
                          </div>
                        </div>

                        {/* Master Admin purge room button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRoom(room)}
                          className="px-3 py-1.5 rounded-full bg-[#FF5376] hover:bg-rose-600 text-white text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#18181B] transition-transform active:scale-95 shrink-0 inline-flex items-center gap-1 cursor-pointer"
                          title="Purge room completely"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Delete</span>
                        </button>
                      </div>

                      {/* Metadata row */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t-2 border-black/10 text-center">
                        <div className="bg-[#FAF7F0] border-2 border-black/15 rounded-2xl p-2 shadow-xs">
                          <span className="block text-sm font-black text-black">{memberCount}</span>
                          <span className="text-[10px] font-bold text-zinc-600">Members</span>
                        </div>
                        <div className="bg-[#FAF7F0] border-2 border-black/15 rounded-2xl p-2 shadow-xs">
                          <span className="block text-sm font-black text-black">{pendingCount}</span>
                          <span className="text-[10px] font-bold text-zinc-600">Requests</span>
                        </div>
                        <div className="bg-[#FAF7F0] border-2 border-black/15 rounded-2xl p-2 shadow-xs">
                          <span className="block text-sm font-black text-black">{invitesCount}</span>
                          <span className="text-[10px] font-bold text-zinc-600">Invites</span>
                        </div>
                      </div>

                      {/* Creator info */}
                      <div className="mt-3 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                        <span>Creator: <span className="font-bold text-black">{room.creator_username ? `@${room.creator_username}` : room.creator_id ? room.creator_id.slice(0, 8) : "System"}</span></span>
                        <span className="truncate max-w-[120px]">ID: {room.id}</span>
                      </div>
                    </div>

                    {/* Member chips preview & quick purge member */}
                    {room.members && room.members.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[10px] font-black text-zinc-600 mb-1.5 uppercase tracking-wider">
                          Members ({room.members.length}):
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto soft-scroll p-2 bg-[#FAF7F0] border-2 border-black/15 rounded-2xl">
                          {room.members.map((mId) => {
                            const foundProfile = users.find((u) => u.id === mId);
                            const label = foundProfile?.username || foundProfile?.display_name || mId.slice(0, 6);
                            return (
                              <span
                                key={mId}
                                className="inline-flex items-center gap-1 text-[11px] bg-white border-2 border-black px-2.5 py-0.5 rounded-full text-black font-bold shadow-[1px_1px_0px_#000]"
                              >
                                <span>@{label}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRoomMember(room.id, mId, label)}
                                  className="text-zinc-400 hover:text-rose-600 ml-0.5 cursor-pointer"
                                  title={`Remove @${label} from room`}
                                >
                                  <X className="w-2.5 h-2.5 stroke-[3]" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmWord={confirmState.confirmWord}
        danger={true}
        onConfirm={async () => {
          if (confirmState.action) await confirmState.action();
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}