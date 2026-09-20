"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, getAuthUser } from "../lib/supabaseClient";
import { formatExactLastSeen } from "./lastSeen";
import {
  Search,
  MessageSquare,
  Users,
  MoreVertical,
  Smile,
  Send,
  CheckCheck,
  ArrowLeft,
  ArrowRight,
  ImageIcon,
  Bell,
  BellOff,
  Ban,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  X,
  Trash2,
} from "lucide-react";
import { useToast } from "./Toast";
import AuthBarrier from "./AuthBarrier";
import ConfirmDialog from "./ConfirmDialog";
import EmojiPicker from "./EmojiPicker";
import { authFetch } from "../lib/apiClient";
import { formatMessageTime, formatMessageDate, formatRelativeTime } from "../lib/dateUtils";

// Deterministic avatar palette — consistent colour per user derived from their name
const AVATAR_PALETTE_LIST = [
  { bg: "bg-[#F3E8FF]", text: "text-[#4A1D96]" },
  { bg: "bg-[#FCE7F3]", text: "text-[#831843]" },
  { bg: "bg-[#E8F8EE]", text: "text-[#064E3B]" },
  { bg: "bg-[#FEF3C7]", text: "text-[#78350F]" },
  { bg: "bg-[#E0F2FE]", text: "text-[#0C4A6E]" },
  { bg: "bg-[#FEF9C3]", text: "text-[#713F12]" },
  { bg: "bg-[#FFEDD5]", text: "text-[#7C2D12]" },
  { bg: "bg-[#DCFCE7]", text: "text-[#14532D]" },
  { bg: "bg-[#E0E7FF]", text: "text-[#1E1B4B]" },
  { bg: "bg-[#FDF2F8]", text: "text-[#701A75]" },
];

function getAvatarPalette(name) {
  if (!name) return AVATAR_PALETTE_LIST[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE_LIST[hash % AVATAR_PALETTE_LIST.length];
}

export default function ChatPage() {
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activePartnerId, setActivePartnerId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(true);
  const [activeTab, setActiveTab] = useState("messages"); // "messages" | "curators"
  const [curators, setCurators] = useState([]);
  const [loadingCurators, setLoadingCurators] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mobileView, setMobileView] = useState("chat"); // "list" | "chat" | "details"
  const [showDetailsMenu, setShowDetailsMenu] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [unsendingId, setUnsendingId] = useState(null);

  // Muted chats state (persisted per user in localStorage)
  const [mutedPartnerIds, setMutedPartnerIds] = useState(() => new Set());
  // Blocked users state (persisted per user in localStorage)
  const [blockedUserIds, setBlockedUserIds] = useState(() => new Set());
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatSearchInputRef = useRef(null);
  const detailsMenuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (detailsMenuRef.current && !detailsMenuRef.current.contains(e.target)) {
        setShowDetailsMenu(false);
      }
    }
    if (showDetailsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDetailsMenu]);

  // Load persisted muted and blocked users on user change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const uid = currentUser?.id || "guest";
    try {
      const storedMuted = localStorage.getItem(`shotzi_muted_${uid}`);
      if (storedMuted) setMutedPartnerIds(new Set(JSON.parse(storedMuted)));
      else setMutedPartnerIds(new Set());
    } catch {}

    try {
      const storedBlocked = localStorage.getItem(`shotzi_blocked_${uid}`);
      if (storedBlocked) setBlockedUserIds(new Set(JSON.parse(storedBlocked)));
      else setBlockedUserIds(new Set());
    } catch {}
  }, [currentUser]);

  const isCurrentMuted = Boolean(activePartnerId && mutedPartnerIds.has(activePartnerId));
  const isCurrentBlocked = Boolean(activePartnerId && blockedUserIds.has(activePartnerId));

  // 1. Initialize user and parse query parameters
  useEffect(() => {
    let ignore = false;
    async function initUser(providedUser = null) {
      const u = providedUser || (await getAuthUser());
      if (!ignore) {
        setCurrentUser(u);
        setAuthLoading(false);
      }

      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const userParam = sp.get("user");
        if (userParam) {
          setActivePartnerId(userParam);
        }
      }
    }
    initUser();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        initUser(session.user);
      } else {
        initUser();
      }
    });

    return () => {
      ignore = true;
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  const activeUserId = currentUser?.id || null;

  // 2. Load conversations list
  const loadConversations = async () => {
    if (!currentUser?.id) {
      setLoadingList(false);
      return;
    }
    try {
      setLoadingList(true);
      const res = await authFetch(`/api/chat/direct?userId=${currentUser.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.conversations) {
          setConversations(data.conversations);
          // If no active partner is set or not in list, default to first conversation
          if (!activePartnerId && data.conversations.length > 0) {
            setActivePartnerId(data.conversations[0].id);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load conversations:", err);
    } finally {
      setLoadingList(false);
    }
  };

  // 2b. Load all curators in the database
  const loadCurators = async () => {
    if (!currentUser?.id) {
      setLoadingCurators(false);
      return;
    }
    try {
      setLoadingCurators(true);
      const res = await authFetch(`/api/chat/direct?userId=${currentUser.id}&curators=true`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.curators) {
          setCurators(data.curators);
        }
      }
    } catch (err) {
      console.warn("Failed to load curators:", err);
    } finally {
      setLoadingCurators(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      loadConversations();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (activeTab === "curators" && curators.length === 0 && currentUser?.id) {
      loadCurators();
    }
  }, [activeTab, currentUser?.id]);

  // 3. Load active conversation thread and partner profile
  const loadThread = async (partnerId) => {
    if (!partnerId || !currentUser?.id) return;
    try {
      setLoadingChat(true);
      const res = await authFetch(`/api/chat/direct?userId=${currentUser.id}&partnerId=${partnerId}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
          setPartnerProfile(data.partner || null);

          // Mark unread messages as read
          authFetch(`/api/chat/direct`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: currentUser.id, partnerId }),
          }).catch(() => {});

          // Clear unread count locally for this conversation
          setConversations((prev) =>
            prev.map((c) => (c.id === partnerId ? { ...c, unreadCount: 0 } : c))
          );
        }
      }
    } catch (err) {
      console.warn("Failed to load thread:", err);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (activePartnerId) {
      loadThread(activePartnerId);
    }
  }, [activePartnerId, activeUserId]);

  // 4. Supabase Realtime Subscription for incoming messages and unsend updates
  useEffect(() => {
    if (!activeUserId) return;

    const channel = supabase
      .channel(`direct_chat_channel_${activeUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          const newMsg = payload.new;
          if (!newMsg) return;

          const isCurrentChat =
            (newMsg.sender_id === activeUserId && newMsg.recipient_id === activePartnerId) ||
            (newMsg.sender_id === activePartnerId && newMsg.recipient_id === activeUserId);

          if (isCurrentChat) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }

          // Update conversations list preview
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          const updatedMsg = payload.new;
          if (!updatedMsg) return;
          // Reflect unsend (or any update) in the live messages list
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId, activePartnerId]);

  // Scroll to bottom within chat container ONLY (prevents whole window from jumping down)
  useEffect(() => {
    if (!showChatSearch && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, showChatSearch]);

  // 5. Send message handler
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (isCurrentBlocked) {
      toast.error("Cannot send messages to a blocked user.");
      return;
    }
    const text = inputText.trim();
    if (!text || sending || !activePartnerId || !currentUser?.id) return;

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      sender_id: currentUser.id,
      recipient_id: activePartnerId,
      message: text,
      created_at: new Date().toISOString(),
      read: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setShowEmojiPicker(false);
    setSending(true);

    try {
      const res = await authFetch(`/api/chat/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: currentUser.id,
          recipient_id: activePartnerId,
          message: text,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.message) {
          // Replace optimistic message with real row
          setMessages((prev) => prev.map((m) => (m.id === tempId ? json.message : m)));
        }
      } else {
        toast.error("Failed to send message. Please try again.");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Message could not be sent.");
    } finally {
      setSending(false);
      chatInputRef.current?.focus({ preventScroll: true });
    }
  };

  // Handle unsending (deleting) a sent DM message
  const handleUnsendMessage = async (msgId) => {
    if (!msgId || unsendingId) return;
    setUnsendingId(msgId);
    try {
      const res = await authFetch(
        `/api/chat/direct?messageId=${msgId}&senderId=${activeUserId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        // Optimistically update local state
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, message: "::shotzi_unsent::", is_unsent: true }
              : m
          )
        );
        toast.success("Message unsent");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Could not unsend message");
      }
    } catch (err) {
      console.error("Unsend error:", err);
      toast.error("Could not unsend message");
    } finally {
      setUnsendingId(null);
    }
  };

  // Filter conversations list by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter(
      (c) =>
        c.profile?.display_name?.toLowerCase().includes(q) ||
        c.profile?.username?.toLowerCase().includes(q) ||
        c.lastMessage?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  // Filter curators list by search
  const filteredCurators = useMemo(() => {
    if (!searchQuery.trim()) return curators;
    const q = searchQuery.toLowerCase().trim();
    return curators.filter(
      (c) =>
        c.display_name?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.bio?.toLowerCase().includes(q)
    );
  }, [curators, searchQuery]);

  // Format relative timestamp helper (e.g., 2m, 1h, 5h, 1d, 1w)
  const formatTimeBadge = (timestamp) => {
    return formatRelativeTime(timestamp);
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDateStr = "";

    messages.forEach((msg) => {
      const dateStr = formatMessageDate(msg.created_at);

      if (dateStr !== currentDateStr) {
        currentDateStr = dateStr;
        groups.push({ type: "date", date: dateStr });
      }
      groups.push({ type: "message", data: msg });
    });

    return groups;
  }, [messages]);

  // Highlight matching search text in message bubble
  const highlightMatch = (text, query) => {
    if (!query?.trim() || !text) return text;
    const q = query.trim();
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-[#FFD21E] text-black px-0.5 rounded font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Matched message IDs in order of messages thread
  const matchedMessageIds = useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    const q = chatSearchQuery.toLowerCase().trim();
    return messages
      .filter((m) => m.message?.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, chatSearchQuery]);

  const scrollToMessage = (msgId) => {
    if (!msgId || typeof document === "undefined") return;
    const el = document.getElementById(`chat-msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Reset currentMatchIndex when search query or matched count changes
  useEffect(() => {
    if (matchedMessageIds.length > 0) {
      setCurrentMatchIndex(0);
      scrollToMessage(matchedMessageIds[0]);
    } else {
      setCurrentMatchIndex(0);
    }
  }, [matchedMessageIds]);

  const handleNextMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchedMessageIds.length;
    setCurrentMatchIndex(nextIdx);
    scrollToMessage(matchedMessageIds[nextIdx]);
  };

  const handlePrevMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matchedMessageIds.length) % matchedMessageIds.length;
    setCurrentMatchIndex(prevIdx);
    scrollToMessage(matchedMessageIds[prevIdx]);
  };

  // Toggle Mute Chat Handler (Persistent in localStorage)
  const toggleMute = () => {
    if (!activePartnerId) return;
    const uid = currentUser?.id || "guest";
    const partnerName = partnerProfile?.username || partnerProfile?.display_name || "creative";
    setMutedPartnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(activePartnerId)) {
        next.delete(activePartnerId);
        toast.success(`Notifications unmuted for @${partnerName}`);
      } else {
        next.add(activePartnerId);
        toast.info(`Notifications muted for @${partnerName}`);
      }
      try {
        localStorage.setItem(`shotzi_muted_${uid}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setShowDetailsMenu(false);
  };

  // Block User Handler (Persistent in localStorage)
  const handleBlockUser = () => {
    if (!activePartnerId) return;
    const uid = currentUser?.id || "guest";
    const partnerName = partnerProfile?.username || partnerProfile?.display_name || "creator";
    setBlockedUserIds((prev) => {
      const next = new Set(prev);
      next.add(activePartnerId);
      try {
        localStorage.setItem(`shotzi_blocked_${uid}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setShowBlockConfirm(false);
    setShowDetailsMenu(false);
    toast.info(`@${partnerName} has been blocked.`);
  };

  // Unblock User Handler
  const handleUnblockUser = () => {
    if (!activePartnerId) return;
    const uid = currentUser?.id || "guest";
    const partnerName = partnerProfile?.username || partnerProfile?.display_name || "creator";
    setBlockedUserIds((prev) => {
      const next = new Set(prev);
      next.delete(activePartnerId);
      try {
        localStorage.setItem(`shotzi_blocked_${uid}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setShowDetailsMenu(false);
    toast.success(`@${partnerName} has been unblocked.`);
  };

  // Avatar helper
  const renderAvatar = (name, avatarUrl, size = "w-11 h-11", textSize = "text-base") => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className={`${size} rounded-full object-cover border border-black/10 shrink-0`}
        />
      );
    }
    const palette = getAvatarPalette(name);
    const letter = (name || "C").charAt(0).toUpperCase();
    return (
      <div
        className={`${size} rounded-full ${palette.bg} ${palette.text} border border-black/10 flex items-center justify-center font-bold ${textSize} shrink-0 select-none shadow-xs`}
      >
        {letter}
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-3 border-black border-t-[#FFD21E] rounded-full animate-spin" />
        <p className="font-bold text-sm text-zinc-600">Connecting to creative space...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthBarrier
        title="Private Conversations"
        subtitle="Sign in to chat with fellow creators, share camera settings, and connect in real time."
        badge="MEMBERS ONLY • CHAT"
        icon={<MessageSquare className="w-7 h-7 text-black stroke-[2.5]" />}
      />
    );
  }

  return (
    <div className="w-full max-w-[1540px] mx-auto px-0 sm:px-2 py-0 sm:py-2 font-sans text-zinc-900">
      {/* 3-COLUMN MAIN CONTAINER */}
      <div className="flex gap-3.5 xl:gap-5 h-[calc(100dvh-120px)] sm:h-[calc(100vh-170px)] min-h-[460px] sm:min-h-[560px]">
        {/* =========================================================================
            COLUMN 1: CONVERSATIONS / CURATORS LIST SIDEBAR
            ========================================================================= */}
        <div
          className={`${
            mobileView === "list" ? "flex" : "max-lg:hidden"
          } w-full lg:w-76 xl:w-80 shrink-0 flex-col justify-between`}
        >
          <div className="space-y-3.5 flex-1 flex flex-col min-h-0">
            {/* Top Toggle Pills: Messages vs Curators */}
            <div className="flex items-center gap-3.5 pt-1.5 pb-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("messages")}
                className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === "messages"
                    ? "bg-[#FFD21E] text-black border-2 border-black shadow-[2px_2px_0px_#18181B]"
                    : "text-zinc-600 hover:text-black hover:bg-black/5"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0 fill-current stroke-current" />
                <span className="leading-none">Messages</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("curators");
                  if (curators.length === 0) loadCurators();
                }}
                className={`inline-flex items-center gap-2.5 px-4.5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === "curators"
                    ? "bg-[#FFD21E] text-black border-2 border-black shadow-[2px_2px_0px_#18181B]"
                    : "text-zinc-600 hover:text-black hover:bg-black/5"
                }`}
              >
                <Users className="w-4 h-4 shrink-0 stroke-[2.2]" />
                <span className="leading-none">Curators</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "messages"
                    ? "Search conversations..."
                    : "Search curators in database..."
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-black/15 bg-white text-xs font-medium text-black placeholder-zinc-400 focus:outline-none focus:border-black shadow-xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* List Items: either Messages or Curators */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {activeTab === "messages" ? (
                loadingList ? (
                  <div className="py-12 text-center text-xs text-zinc-400">Loading conversations...</div>
                ) : filteredConversations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-400">No conversations found</div>
                ) : (
                  filteredConversations.map((c) => {
                    const isSelected = c.id === activePartnerId;
                    const displayName = c.profile?.display_name || c.profile?.username || "Creative";
                    const timeBadge = formatTimeBadge(c.lastMessageTime);
                    const displayUnread = c.unreadCount || 0;

                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActivePartnerId(c.id);
                          setMobileView("chat");
                          if (typeof window !== "undefined") {
                            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all ${
                          isSelected
                            ? "bg-[#FEF9C3] shadow-[1px_1px_0px_#18181B]"
                            : "hover:bg-zinc-200/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          {renderAvatar(displayName, c.profile?.avatar_url, "w-10 h-10 sm:w-11 sm:h-11 shrink-0", "text-sm")}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="font-bold text-xs sm:text-sm text-black truncate leading-tight">
                                {displayName}
                              </p>
                              {blockedUserIds.has(c.id) && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-600 border border-red-200 shrink-0">
                                  Blocked
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-zinc-500 truncate leading-normal mt-0.5 block">
                              {c.lastMessage || "Started a conversation"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                          <div className="flex items-center gap-1">
                            {mutedPartnerIds.has(c.id) && (
                              <BellOff className="w-3 h-3 text-zinc-400 shrink-0" title="Muted" />
                            )}
                            <span className="text-[10px] text-zinc-400 font-medium">{timeBadge}</span>
                          </div>
                          {displayUnread > 0 && (
                            <span className="w-4.5 h-4.5 rounded-full bg-[#FFD21E] text-black text-[10px] font-black border border-black/30 flex items-center justify-center shadow-xs">
                              {displayUnread}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                /* CURATORS TAB: Showing all users from database */
                loadingCurators ? (
                  <div className="py-12 text-center text-xs text-zinc-400">Loading curators...</div>
                ) : filteredCurators.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-400">No curators found</div>
                ) : (
                  filteredCurators.map((curator) => {
                    const isSelected = curator.id === activePartnerId;
                    const displayName = curator.display_name || curator.username || "Creative";

                    return (
                      <div
                        key={curator.id}
                        onClick={() => {
                          setActivePartnerId(curator.id);
                          setConversations((prev) => {
                            if (prev.some((p) => p.id === curator.id)) return prev;
                            return [
                              {
                                id: curator.id,
                                profile: curator,
                                lastMessage: "Started a conversation",
                                lastMessageTime: new Date().toISOString(),
                                unreadCount: 0,
                              },
                              ...prev,
                            ];
                          });
                          setActiveTab("messages");
                          setMobileView("chat");
                          if (typeof window !== "undefined") {
                            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all ${
                          isSelected
                            ? "bg-[#FEF9C3] shadow-[1px_1px_0px_#18181B]"
                            : "hover:bg-zinc-200/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          {renderAvatar(displayName, curator.avatar_url, "w-10 h-10 sm:w-11 sm:h-11 shrink-0", "text-sm")}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="font-bold text-xs sm:text-sm text-black truncate leading-tight">
                                {displayName}
                              </p>
                              <span className="text-[10px] text-zinc-400 font-normal truncate">
                                @{curator.username}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-zinc-500 truncate leading-normal mt-0.5 block">
                              {curator.bio || "Active on Shotzi"}
                            </p>
                          </div>
                        </div>

                        <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 hover:bg-[#FFD21E] hover:text-black px-2.5 py-1 rounded-full border border-black/10 transition-colors shrink-0">
                          Chat
                        </span>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>

          {/* Bottom Left Doodle: GOOD CONVERSATIONS BETTER SHOTS. */}
          <div className="pt-4 pb-2 select-none pointer-events-none flex items-center gap-2.5 text-black">
            <svg
              className="w-7 h-7 text-black stroke-current fill-none stroke-[2]"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <div className="font-sans font-black text-[10px] tracking-wider uppercase leading-tight">
              Good
              <br />
              Conversations
              <br />
              Better Shots.
            </div>
          </div>
        </div>

        {/* =========================================================================
            COLUMN 2: MAIN ACTIVE CHAT ROOM WINDOW
            ========================================================================= */}
        <div
          className={`${
            mobileView === "chat" ? "flex" : "max-lg:hidden"
          } flex-1 min-w-0 bg-white rounded-3xl border-2 border-black shadow-[3px_3px_0px_#18181B] flex flex-col overflow-hidden`}
        >
          {/* Top Chat Room Header */}
          <div className="px-5 sm:px-6 py-3.5 border-b border-black/10 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="lg:hidden p-1.5 rounded-full hover:bg-zinc-100 text-black mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {partnerProfile && (
                <>
                  {renderAvatar(
                    partnerProfile.display_name || partnerProfile.username,
                    partnerProfile.avatar_url,
                    "w-10 h-10",
                    "text-sm"
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="font-bold text-sm sm:text-base text-black truncate leading-tight">
                        {partnerProfile.display_name || partnerProfile.username || "Creative"}
                      </h2>
                      {isCurrentMuted && (
                        <BellOff className="w-3.5 h-3.5 text-amber-600 shrink-0" title="Notifications muted" />
                      )}
                      {isCurrentBlocked && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 border border-red-300 shrink-0">
                          Blocked
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 font-normal">
                      {partnerProfile.last_active
                        ? formatExactLastSeen(partnerProfile.last_active)?.text
                        : "Offline"}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Header action buttons (Text-based only, no audio/video calling) */}
            <div className="flex items-center gap-1.5 text-zinc-600">
              <button
                type="button"
                onClick={() => {
                  setShowChatSearch((prev) => !prev);
                  setTimeout(() => chatSearchInputRef.current?.focus(), 50);
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  showChatSearch
                    ? "bg-[#FFD21E] text-black border border-black"
                    : "hover:bg-zinc-100 text-zinc-500 hover:text-black"
                }`}
                title="Search in conversation"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setMobileView("details")}
                className="xl:hidden w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors text-zinc-500 hover:text-black"
                title="Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* In-Chat Search Bar Drawer */}
          {showChatSearch && (
            <div className="px-4 sm:px-6 py-2.5 bg-[#FAF8F5] border-b-2 border-black/10 flex items-center gap-2 shrink-0 transition-all">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                ref={chatSearchInputRef}
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.shiftKey) handlePrevMatch();
                    else handleNextMatch();
                  } else if (e.key === "Escape") {
                    setShowChatSearch(false);
                    setChatSearchQuery("");
                  }
                }}
                placeholder="Search messages... (Enter for next, Shift+Enter for prev)"
                className="flex-1 bg-transparent text-xs sm:text-sm font-medium text-black placeholder-zinc-400 focus:outline-none"
              />
              {chatSearchQuery && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-black font-black px-2 py-0.5 bg-[#FFD21E] border border-black rounded-full shadow-[1px_1px_0px_#000]">
                    {matchedMessageIds.length > 0
                      ? `${currentMatchIndex + 1} of ${matchedMessageIds.length}`
                      : "0 matches"}
                  </span>
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    disabled={matchedMessageIds.length === 0}
                    className="p-1 rounded-full hover:bg-zinc-200 disabled:opacity-30 transition-colors text-black cursor-pointer"
                    title="Previous match (Shift+Enter)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    disabled={matchedMessageIds.length === 0}
                    className="p-1 rounded-full hover:bg-zinc-200 disabled:opacity-30 transition-colors text-black cursor-pointer"
                    title="Next match (Enter)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowChatSearch(false);
                  setChatSearchQuery("");
                }}
                className="p-1 rounded-full hover:bg-zinc-200 text-zinc-400 hover:text-black transition-colors shrink-0 cursor-pointer"
                title="Close search (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Chat Messages Scrolling Thread */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {loadingChat ? (
              <div className="py-20 text-center text-xs text-zinc-400">Loading messages...</div>
            ) : groupedMessages.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <p className="font-serif text-xl text-zinc-800 font-normal">No messages yet</p>
                <p className="text-xs text-zinc-500">Say hello and start the conversation!</p>
              </div>
            ) : (
              groupedMessages.map((item, idx) => {
                if (item.type === "date") {
                  return (
                    <div key={`date-${idx}`} className="flex justify-center my-4">
                      <span className="bg-zinc-100 border border-zinc-200/80 text-zinc-500 text-[11px] font-semibold px-3 py-1 rounded-full shadow-2xs">
                        {item.date}
                      </span>
                    </div>
                  );
                }

                const msg = item.data;
                const isMe = msg.sender_id === activeUserId;
                const timeStr = formatMessageTime(msg.created_at);
                const isUnsent =
                  msg.is_unsent === true ||
                  (typeof msg.message === "string" && msg.message.startsWith("::shotzi_unsent::"));

                const isMatchActive = Boolean(
                  !isUnsent && chatSearchQuery && matchedMessageIds[currentMatchIndex] === msg.id
                );
                const isHovered = hoveredMsgId === msg.id;

                if (isMe) {
                  return (
                    <div
                      key={msg.id || idx}
                      id={`chat-msg-${msg.id}`}
                      className={`group flex flex-col items-end self-end max-w-[80%] sm:max-w-[70%] ml-auto transition-all duration-200 ${
                        isMatchActive ? "scale-[1.02] ring-2 ring-black rounded-2xl p-0.5" : ""
                      }`}
                      onMouseEnter={() => setHoveredMsgId(msg.id)}
                      onMouseLeave={() => setHoveredMsgId(null)}
                    >
                      <div className="flex items-end gap-1.5">
                        {/* Unsend button — only visible on hover, only for own non-unsent messages */}
                        {!isUnsent && isHovered && (
                          <button
                            type="button"
                            onClick={() => handleUnsendMessage(msg.id)}
                            disabled={unsendingId === msg.id}
                            title="Unsend message"
                            className="mb-1 p-1 rounded-full bg-white border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        {isUnsent ? (
                          <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl rounded-tr-xs bg-zinc-100 border border-zinc-200">
                            <Ban className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="text-[11px] italic text-zinc-400">You unsent a message</span>
                          </div>
                        ) : (
                          <div
                            className={`text-black text-xs sm:text-sm font-medium px-4 py-2.5 rounded-2xl rounded-tr-xs leading-relaxed shadow-xs ${
                              isMatchActive ? "bg-[#FDE047] border-2 border-black font-bold shadow-md" : "bg-[#FFD21E]"
                            }`}
                          >
                            {highlightMatch(msg.message, chatSearchQuery)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1 pr-1 font-medium">
                        <span>{timeStr}</span>
                        {!isUnsent && <CheckCheck className="w-3.5 h-3.5 text-zinc-500 stroke-[2]" />}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id || idx}
                    id={`chat-msg-${msg.id}`}
                    className={`flex items-start gap-2.5 max-w-[80%] sm:max-w-[70%] transition-all duration-200 ${
                      isMatchActive ? "scale-[1.02] ring-2 ring-black rounded-2xl p-0.5" : ""
                    }`}
                  >
                    {partnerProfile &&
                      renderAvatar(
                        partnerProfile.display_name || partnerProfile.username,
                        partnerProfile.avatar_url,
                        "w-7 h-7 mt-0.5",
                        "text-xs"
                      )}
                    <div>
                      {isUnsent ? (
                        <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl rounded-tl-xs bg-zinc-100 border border-zinc-200">
                          <Ban className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="text-[11px] italic text-zinc-400">This message was unsent</span>
                        </div>
                      ) : (
                        <div
                          className={`text-black text-xs sm:text-sm px-4 py-2.5 rounded-2xl rounded-tl-xs leading-relaxed shadow-2xs ${
                            isMatchActive ? "bg-[#FEF08A] border-2 border-black font-bold shadow-md" : "bg-[#F4F4F5]"
                          }`}
                        >
                          {highlightMatch(msg.message, chatSearchQuery)}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-400 mt-1 pl-1 font-medium">
                        {timeStr}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Message Input Bar or Blocked Notice */}
          {isCurrentBlocked ? (
            <div className="px-4 sm:px-6 py-4 bg-red-50/70 border-t-2 border-black/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2 text-zinc-800 text-xs font-semibold">
                <Ban className="w-4 h-4 text-red-500 shrink-0" />
                <span>You blocked @{partnerProfile?.username || "this creator"}. Messages cannot be sent.</span>
              </div>
              <button
                type="button"
                onClick={handleUnblockUser}
                className="px-4 py-1.5 rounded-full bg-white border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-zinc-50 active:translate-y-0.5 transition-all shrink-0 cursor-pointer"
              >
                Unblock User
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSendMessage}
              className="relative px-4 sm:px-6 py-3.5 bg-white border-t border-black/10 flex items-center gap-3 shrink-0"
            >
              {/* WhatsApp-Grade Full Emoji Picker */}
              <EmojiPicker
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onSelectEmoji={(emoji) => {
                  setInputText((prev) => prev + emoji);
                  chatInputRef.current?.focus();
                }}
                align="left"
              />

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                  showEmojiPicker
                    ? "bg-[#FFD21E] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#18181B]"
                    : "hover:bg-zinc-100 text-zinc-500 hover:text-black"
                }`}
                title="WhatsApp Emojis"
              >
                <Smile className="w-5 h-5 stroke-[1.8]" />
              </button>

              <div className="flex-1 relative flex items-center">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Message @${partnerProfile?.username || "creative"}...`}
                  className="w-full bg-[#FAF8F5] border border-black/15 rounded-full pl-4 pr-10 py-2.5 text-xs sm:text-sm font-medium text-black placeholder-zinc-400 focus:outline-none focus:border-black focus:bg-white shadow-xs transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`absolute right-3.5 transition-colors cursor-pointer ${
                    showEmojiPicker ? "text-black" : "text-zinc-400 hover:text-black"
                  }`}
                  title="WhatsApp Emojis"
                >
                  <Smile className="w-4 h-4 stroke-[1.8]" />
                </button>
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="w-10 h-10 rounded-full bg-[#FFD21E] hover:bg-[#FACC15] disabled:opacity-50 disabled:pointer-events-none text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all shrink-0 cursor-pointer"
                title="Send message"
              >
                <Send className="w-4 h-4 translate-x-0.5 stroke-[2.2]" />
              </button>
            </form>
          )}
        </div>

        {/* =========================================================================
            COLUMN 3: USER PROFILE & DETAILS PANEL (TWO COMPACT CARDS)
            ========================================================================= */}
        <div
          className={`${
            mobileView === "details" ? "flex" : "max-xl:hidden"
          } w-full xl:w-76 2xl:w-80 shrink-0 flex flex-col gap-4 p-1.5 pb-6 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
        >
          {/* CARD 1: PROFILE SUMMARY CARD */}
          <div className="bg-white rounded-3xl border-2 border-black shadow-[3.5px_3.5px_0px_#18181B] p-5 sm:p-5.5 flex flex-col relative shrink-0 transition-all">
            {/* Top row with Mobile Back & Options dropdown */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setMobileView("chat")}
                className="xl:hidden inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-black bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-black shadow-[2px_2px_0px_#18181B] transition-colors"
                title="Back to conversation"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Chat</span>
              </button>

              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-[#FAF8F5] border border-black/15 text-[10px] font-black uppercase tracking-wider text-zinc-600 shadow-2xs">
                Curator
              </span>

              <div className="ml-auto relative" ref={detailsMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowDetailsMenu((prev) => !prev)}
                  className="w-8 h-8 rounded-full border border-black/15 hover:border-black bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-black transition-all shadow-2xs cursor-pointer"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown Menu for Actions */}
                {showDetailsMenu && (
                  <div className="absolute right-0 top-9 w-56 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#18181B] p-1.5 z-50 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailsMenu(false);
                        setMobileView("chat");
                        setShowChatSearch(true);
                        setTimeout(() => chatSearchInputRef.current?.focus(), 50);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors text-left font-bold cursor-pointer"
                    >
                      <Search className="w-4 h-4 text-zinc-500" />
                      <span>Search in chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors font-bold cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {isCurrentMuted ? (
                          <BellOff className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Bell className="w-4 h-4 text-zinc-500" />
                        )}
                        <span>Mute chat</span>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition-all ${
                          isCurrentMuted
                            ? "bg-[#FEF08A] text-black border-black shadow-[1px_1px_0px_#000]"
                            : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        }`}
                      >
                        {isCurrentMuted ? "Muted" : "Off"}
                      </span>
                    </button>

                    {isCurrentBlocked ? (
                      <button
                        type="button"
                        onClick={handleUnblockUser}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-emerald-700 hover:bg-emerald-50 transition-colors text-left font-bold cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Unblock user</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowDetailsMenu(false);
                          setShowBlockConfirm(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors text-left font-bold cursor-pointer"
                      >
                        <Ban className="w-4 h-4 text-red-500" />
                        <span>Block user</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Profile Avatar & Info Card */}
            {partnerProfile && (
              <div className="text-center flex flex-col items-center">
                <div className="relative mb-3">
                  {renderAvatar(
                    partnerProfile.display_name || partnerProfile.username,
                    partnerProfile.avatar_url,
                    "w-20 h-20",
                    "text-2xl"
                  )}
                  <span
                    className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                      partnerProfile.last_active &&
                      Date.now() - new Date(partnerProfile.last_active).getTime() < 5 * 60 * 1000
                        ? "bg-emerald-500"
                        : "bg-zinc-400"
                    } shadow-xs`}
                  />
                </div>

                <h3 className="font-bold text-base sm:text-lg text-black leading-tight tracking-tight">
                  {partnerProfile.display_name || partnerProfile.username}
                </h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  @{partnerProfile.username}
                </p>

                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-black/10 text-[11px] text-zinc-500">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      partnerProfile.last_active &&
                      Date.now() - new Date(partnerProfile.last_active).getTime() < 5 * 60 * 1000
                        ? "bg-emerald-500"
                        : "bg-zinc-400"
                    }`}
                  />
                  <span>
                    {partnerProfile.last_active
                      ? formatExactLastSeen(partnerProfile.last_active)?.text
                      : "Offline"}
                  </span>
                </div>

                {partnerProfile.bio && (
                  <div className="w-full mt-3 py-2 px-3 bg-[#FAF8F5] border border-black/10 rounded-2xl text-xs text-zinc-600 italic text-center leading-relaxed">
                    "{partnerProfile.bio}"
                  </div>
                )}

                {/* Stats Row (Compact Neo-brutalist pill card) */}
                <div className="w-full grid grid-cols-3 text-center py-2.5 px-2 bg-[#FAF8F5] border-2 border-black/10 rounded-2xl mt-4 shadow-2xs">
                  <div className="border-r border-black/10">
                    <p className="font-black text-sm sm:text-base text-black leading-tight">{partnerProfile.shotsCount ?? 0}</p>
                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Shots</p>
                  </div>
                  <div className="border-r border-black/10">
                    <p className="font-black text-sm sm:text-base text-black leading-tight">{partnerProfile.followersCount ?? 0}</p>
                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Followers</p>
                  </div>
                  <div>
                    <p className="font-black text-sm sm:text-base text-black leading-tight">{partnerProfile.followingCount ?? 0}</p>
                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Following</p>
                  </div>
                </div>

                {/* View Profile Button */}
                <Link
                  href={`/u/${partnerProfile.username}`}
                  className="w-full py-2.5 px-4 rounded-full border-2 border-black bg-white hover:bg-[#FFD21E] text-xs font-bold text-black flex items-center justify-center gap-2 shadow-[2.5px_2.5px_0px_#18181B] hover:shadow-[3.5px_3.5px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#18181B] transition-all mt-4"
                >
                  <span>View Profile</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </Link>
              </div>
            )}
          </div>

          {/* CARD 2: SHARED MEDIA CARD */}
          <div className="bg-white rounded-3xl border-2 border-black shadow-[3.5px_3.5px_0px_#18181B] p-5 flex flex-col shrink-0 transition-all">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#FFD21E] border border-black flex items-center justify-center text-black shadow-2xs">
                  <ImageIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="font-bold text-xs sm:text-sm text-black tracking-tight">Shared Media</span>
              </div>
              {partnerProfile?.username && (
                <button
                  type="button"
                  onClick={() => router.push(`/u/${partnerProfile.username}`)}
                  className="text-xs text-zinc-500 hover:text-black font-semibold hover:underline transition-colors"
                >
                  View all
                </button>
              )}
            </div>

            {(partnerProfile?.sharedMedia || []).length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {partnerProfile.sharedMedia.map((m, i) => (
                  <div
                    key={m.id || i}
                    className="aspect-square rounded-xl overflow-hidden border-2 border-black bg-zinc-100 hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer shadow-[2px_2px_0px_#18181B]"
                    title={m.caption || "Shot"}
                  >
                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-zinc-500 border-2 border-dashed border-black/15 rounded-2xl bg-[#FAF8F5] flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-white border border-black/10 flex items-center justify-center text-zinc-400 shadow-2xs">
                  <ImageIcon className="w-5 h-5 stroke-[1.5]" />
                </div>
                <span className="font-medium text-zinc-500">No shared shots yet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showBlockConfirm}
        title={`Block @${partnerProfile?.username || partnerProfile?.display_name || "user"}?`}
        description={`Are you sure you want to block @${partnerProfile?.username || "this creator"}? You will no longer receive or be able to send messages to this account. You can unblock them at any time.`}
        confirmLabel="Block User"
        danger={true}
        onConfirm={handleBlockUser}
        onCancel={() => setShowBlockConfirm(false)}
      />
    </div>
  );
}
