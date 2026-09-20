"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useMemo } from "react";
import { supabase, getAuthUser } from "../lib/supabaseClient";
import { formatExactLastSeen, formatLastChatted } from "./lastSeen";
import { format } from "date-fns";
import { parseSafeDate } from "../lib/dateUtils";
import {
  Globe,
  Send,
  Smile,
  Plus,
  Search,
  Users,
  Lock,
  Share2,
  Shield,
  Sun,
  Sparkles,
  ArrowRight,
  Menu,
  X,
  Clock,
  CheckCircle2,
  Moon,
  Camera,
  Music,
  Leaf,
  GraduationCap,
  Dice5,
  Palette,
  Heart,
  Flame,
  Coffee,
  Maximize2,
  Minimize2,
  MessageSquare,
  LogOut,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useToast } from "./Toast";
import { useAuthDrawer } from "./AuthDrawer";
import AuthBarrier from "./AuthBarrier";
import { authFetch } from "../lib/apiClient";
import ChatMessageItem from "./ChatMessageItem";
import CreateRoomModal from "./CreateRoomModal";
import RoomInviteModal from "./RoomInviteModal";
import EmojiPicker from "./EmojiPicker";
import JoinRequestsModal from "./JoinRequestsModal";
import { isAdmin } from "../lib/admin";

// Helper to map icon names to Lucide icons
const ROOM_ICONS = {
  globe: Globe,
  moon: Moon,
  camera: Camera,
  music: Music,
  leaf: Leaf,
  graduation: GraduationCap,
  dice: Dice5,
  sparkles: Sparkles,
  palette: Palette,
  heart: Heart,
  flame: Flame,
  coffee: Coffee,
  lock: Lock,
};

// Date label helper for message grouping
function getMessageDateKey(dateStr) {
  if (!dateStr) return "Unknown";
  try {
    const d = parseSafeDate(dateStr);
    const now = new Date();
    if (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    ) {
      return `Today · ${format(d, "MMM d, yyyy")}`;
    }
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    if (
      d.getDate() === yest.getDate() &&
      d.getMonth() === yest.getMonth() &&
      d.getFullYear() === yest.getFullYear()
    ) {
      return `Yesterday · ${format(d, "MMM d, yyyy")}`;
    }
    return format(d, "MMMM d, yyyy");
  } catch {
    return "Earlier";
  }
}

export default function GlobalChat() {
  const [currentUser, setCurrentUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("room");
      if (p) return p;
    }
    return "everyone";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [rawMessages, setRawMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [onlineProfiles, setOnlineProfiles] = useState([]);
  const [livePresenceUserIds, setLivePresenceUserIds] = useState(new Set());
  const [lastChattedMap, setLastChattedMap] = useState({});
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [mobileRoomsOpen, setMobileRoomsOpen] = useState(false);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const toast = useToast();
  const { openAuth } = useAuthDrawer();

  // Lock body scroll only when Fullscreen Mode is active
  useEffect(() => {
    if (isFullscreen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isFullscreen]);

  // 2. Get current authenticated user
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function loadUser() {
      const u = await getAuthUser();
      if (!ignore) {
        setCurrentUser(u);
        setAuthLoading(false);
      }
    }
    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      ignore = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // 3. Realtime Heartbeat: update current user's last_active periodically
  useEffect(() => {
    if (!currentUser) return;

    const pingHeartbeat = async () => {
      try {
        await supabase
          .from("profiles")
          .update({ last_active: new Date().toISOString() })
          .eq("id", currentUser.id);
      } catch (err) {}
    };

    pingHeartbeat();
    const iv = setInterval(pingHeartbeat, 30 * 1000);
    return () => clearInterval(iv);
  }, [currentUser]);

  // 4. Supabase Realtime Presence Channel: live presence tracking
  useEffect(() => {
    if (!currentUser) return;

    const presenceChannel = supabase.channel("shotzi-live-presence", {
      config: {
        presence: { key: currentUser.id },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const ids = new Set(Object.keys(state));
        setLivePresenceUserIds(ids);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        setLivePresenceUserIds((prev) => new Set([...prev, key]));
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setLivePresenceUserIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: currentUser.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUser]);

  // 5. Fetch community profiles & build latest message timestamps per user
  useEffect(() => {
    if (!currentUser) return;
    async function loadCommunityProfiles() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, last_active")
          .order("last_active", { ascending: false, nullsFirst: false })
          .limit(40);

        if (!error && data) {
          setOnlineProfiles(data);
          const pMap = {};
          data.forEach((p) => {
            pMap[p.id] = p;
          });
          setProfiles((prev) => ({ ...prev, ...pMap }));
        }

        // Fetch when each user last chatted in global_messages
        const { data: recentMsgs } = await supabase
          .from("global_messages")
          .select("user_id, created_at")
          .order("created_at", { ascending: false })
          .limit(500);

        if (recentMsgs && recentMsgs.length > 0) {
          const chatMap = {};
          recentMsgs.forEach((m) => {
            if (!chatMap[m.user_id]) {
              chatMap[m.user_id] = m.created_at;
            }
          });
          setLastChattedMap(chatMap);
        }
      } catch (err) {
        console.error("Error loading community data:", err);
      }
    }
    loadCommunityProfiles();

    // Live subscription on profiles table updates
    const profileSub = supabase
      .channel("profiles-live-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          setOnlineProfiles((prev) =>
            prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
          );
          setProfiles((prev) => ({
            ...prev,
            [payload.new.id]: { ...(prev[payload.new.id] || {}), ...payload.new },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileSub);
    };
  }, [currentUser]);

  // 6. Fetch Rooms from API (Everyone's Corner + real created rooms)
  const fetchRooms = async () => {
    if (!currentUser) return;
    try {
      const url = `/api/chat/rooms?userId=${currentUser.id}`;
      const res = await authFetch(url);
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [currentUser]);

  // URL query params & auto-join if invite link
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const inviteParam = params.get("invite");

    if (roomParam && roomParam !== selectedRoomId) {
      setSelectedRoomId(roomParam);
    }

    if (roomParam && inviteParam && currentUser) {
      authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          roomId: roomParam,
          userId: currentUser.id,
          username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0],
          display_name: currentUser.user_metadata?.display_name,
          avatar_url: currentUser.user_metadata?.avatar_url,
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.status === "joined") {
            toast.success("Welcome! You joined the room.");
          } else if (result.status === "pending") {
            toast.info("Join request submitted to group creator.");
          }
          fetchRooms();
        })
        .catch(() => {});
    }
  }, [currentUser]);

  // Synchronize browser history / back / forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const p = new URLSearchParams(window.location.search).get("room") || "everyone";
      setSelectedRoomId(p);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectRoom = (roomId) => {
    setSelectedRoomId(roomId);
    setMobileRoomsOpen(false);
    if (typeof window !== "undefined") {
      const newUrl =
        roomId === "everyone"
          ? "/chat/global"
          : `/chat/global?room=${encodeURIComponent(roomId)}`;
      window.history.pushState({}, "", newUrl);
    }
  };

  // Active room object
  const activeRoom = useMemo(() => {
    return (
      rooms.find((r) => r.id === selectedRoomId) ||
      rooms[0] || {
        id: "everyone",
        name: "Everyone's Corner",
        description: "Open chat for all",
        icon: "globe",
        image_url: "",
        is_private: false,
      }
    );
  }, [rooms, selectedRoomId]);

  // Fetch missing profile data for members in the active room
  useEffect(() => {
    if (!activeRoom || !Array.isArray(activeRoom.members) || activeRoom.members.length === 0) return;
    const missingIds = activeRoom.members.filter((id) => id && !profiles[id]);
    if (missingIds.length === 0) return;

    let ignore = false;
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, last_active")
      .in("id", missingIds)
      .then(({ data, error }) => {
        if (!error && data && !ignore) {
          const map = {};
          data.forEach((p) => {
            map[p.id] = p;
          });
          setProfiles((prev) => ({ ...prev, ...map }));
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeRoom?.members, profiles]);

  // Membership permissions: Master Admin (prvmehrotra@gmail.com) has absolute authority
  const isMasterAdmin = useMemo(() => {
    return Boolean(currentUser && isAdmin(currentUser));
  }, [currentUser]);

  const isMember = useMemo(() => {
    if (!activeRoom.is_private) return true;
    if (!currentUser) return false;
    if (activeRoom.creator_id === currentUser.id || isMasterAdmin) return true;
    return Boolean(activeRoom.members?.includes(currentUser.id));
  }, [activeRoom, currentUser, isMasterAdmin]);

  const isCreator = useMemo(() => {
    return Boolean(
      currentUser && (activeRoom.creator_id === currentUser.id || isMasterAdmin)
    );
  }, [activeRoom, currentUser, isMasterAdmin]);

  const hasPendingRequest = useMemo(() => {
    if (!currentUser || !activeRoom.pending_requests) return false;
    return activeRoom.pending_requests.some((p) => p.user_id === currentUser.id);
  }, [activeRoom, currentUser]);

  // 7. Load Messages from Supabase
  useEffect(() => {
    let ignore = false;

    async function loadMessages() {
      try {
        setLoadingMessages(true);
        const { data, error } = await supabase
          .from("global_messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(400);

        if (error) throw error;
        if (!ignore) {
          setRawMessages(data || []);

          const userIds = [...new Set((data || []).map((m) => m.user_id))];
          if (userIds.length > 0) {
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url, last_active")
              .in("id", userIds);

            const pMap = {};
            (profilesData || []).forEach((p) => {
              pMap[p.id] = p;
            });
            setProfiles((prev) => ({ ...prev, ...pMap }));
          }
          setLoadingMessages(false);
        }
      } catch (err) {
        console.error("Error loading chat messages:", err);
        if (!ignore) setLoadingMessages(false);
      }
    }

    loadMessages();

    // Realtime Supabase Channel for INSERT and DELETE
    const channel = supabase
      .channel("shotzi_global_chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_messages" },
        (payload) => {
          setRawMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });

          // Update lastChattedMap immediately
          const senderId = payload.new.user_id;
          setLastChattedMap((prev) => ({
            ...prev,
            [senderId]: payload.new.created_at,
          }));

          // Fetch sender profile if missing
          if (!profiles[senderId]) {
            supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url, last_active")
              .eq("id", senderId)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setProfiles((curr) => ({ ...curr, [data.id]: data }));
                }
              });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "global_messages" },
        (payload) => {
          setRawMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "global_messages" },
        (payload) => {
          setRawMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m))
          );
        }
      )
      .on("broadcast", { event: "unsend" }, ({ payload }) => {
        if (!payload?.messageId) return;
        setRawMessages((prev) =>
          prev.map((m) => {
            if (m.id === payload.messageId) {
              const currentParsed = parseMessageContent(m);
              return {
                ...m,
                _parsed: {
                  ...currentParsed,
                  text: "",
                  is_unsent: true,
                  unsent_at: payload.unsentAt || new Date().toISOString(),
                },
              };
            }
            return m;
          })
        );
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== currentUser?.id && payload.roomId === selectedRoomId) {
          setTypingUsers((curr) => {
            if (curr.some((u) => u.userId === payload.userId)) return curr;
            return [...curr, payload];
          });
          setTimeout(() => {
            setTypingUsers((curr) => curr.filter((u) => u.userId !== payload.userId));
          }, 3000);
        }
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        setRawMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === payload.messageId) {
              const currentParsed = parseMessageContent(msg);
              const reactions = { ...(currentParsed.reactions || {}) };
              const currentUsers = reactions[payload.emoji] || [];
              if (currentUsers.includes(payload.userId)) {
                reactions[payload.emoji] = currentUsers.filter((id) => id !== payload.userId);
              } else {
                reactions[payload.emoji] = [...currentUsers, payload.userId];
              }
              return {
                ...msg,
                _parsed: {
                  ...currentParsed,
                  reactions,
                },
              };
            }
            return msg;
          })
        );
      })
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, [selectedRoomId, currentUser]);

  // Parse message payload
  const parseMessageContent = (row) => {
    if (row._parsed) return row._parsed;
    const content = row.message || row.content || "";
    try {
      if (content.startsWith("{") && content.endsWith("}")) {
        const parsed = JSON.parse(content);
        return {
          text: parsed.is_unsent ? "" : (parsed.text || ""),
          is_unsent: Boolean(parsed.is_unsent),
          unsent_at: parsed.unsent_at || null,
          roomId: parsed.roomId || parsed.room_id || "everyone",
          reactions: parsed.reactions || {},
        };
      }
    } catch {}

    if (content.startsWith("::shotzi_unsent::")) {
      return {
        text: "",
        is_unsent: true,
        unsent_at: null,
        roomId: "everyone",
        reactions: {},
      };
    }

    return {
      text: content,
      is_unsent: false,
      unsent_at: null,
      roomId: "everyone",
      reactions: {},
    };
  };

  // Filter messages for active room
  const activeRoomMessages = useMemo(() => {
    return rawMessages
      .map((m) => {
        const parsed = parseMessageContent(m);
        return {
          id: m.id,
          senderId: m.user_id,
          createdAt: m.created_at,
          ...parsed,
        };
      })
      .filter((m) => {
        if (selectedRoomId === "everyone") {
          return !m.roomId || m.roomId === "everyone";
        }
        return m.roomId === selectedRoomId;
      });
  }, [rawMessages, selectedRoomId, currentUser]);

  // Group messages by date with clear dividers
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDateKey = null;

    activeRoomMessages.forEach((msg) => {
      const dateKey = getMessageDateKey(msg.createdAt);
      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        groups.push({ type: "divider", key: dateKey, label: dateKey });
      }
      groups.push({ type: "message", key: msg.id, msg });
    });

    return groups;
  }, [activeRoomMessages]);

  // Auto-scroll internal messages container on new incoming messages
  // STRICTLY CONTAINER ONLY: Never scroll or jump the outer browser window
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [activeRoomMessages.length]);

  // Leave room handler (for regular members of custom rooms)
  const handleLeaveRoom = async () => {
    if (!currentUser || activeRoom.id === "everyone") return;
    const confirmed = window.confirm(`Are you sure you want to leave "${activeRoom.name}"?`);
    if (!confirmed) return;

    try {
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          roomId: activeRoom.id,
          userId: currentUser.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave room.");

      toast.success(`You left "${activeRoom.name}".`);
      setSelectedRoomId("everyone");
      await fetchRooms();
    } catch (err) {
      toast.error(err.message || "Failed to leave room.");
    }
  };

  // Delete / Finish room handler (authority for room creator)
  const handleDeleteRoom = async () => {
    if (!currentUser || activeRoom.id === "everyone" || !isCreator) return;
    const confirmed = window.confirm(
      `Are you sure you want to completely finish and remove "${activeRoom.name}"? All messages and memberships will be permanently deleted.`
    );
    if (!confirmed) return;

    try {
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_room",
          roomId: activeRoom.id,
          creatorId: currentUser.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to finish room.");

      toast.success(`Room "${activeRoom.name}" has been completely finished and removed.`);
      setSelectedRoomId("everyone");
      setRawMessages((prev) =>
        prev.filter((m) => parseMessageContent(m).roomId !== activeRoom.id)
      );
      await fetchRooms();
    } catch (err) {
      toast.error(err.message || "Failed to finish room.");
    }
  };

  // Send message handler (Pure text based)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending || !currentUser) return;
    if (!isMember) {
      toast.error("You must be an accepted member to post in this room.");
      return;
    }

    try {
      setSending(true);
      const messageText = input.trim();
      const dbPayload =
        selectedRoomId === "everyone"
          ? messageText
          : JSON.stringify({
              text: messageText,
              roomId: selectedRoomId,
              reactions: {},
            });

      const parsedMemory = {
        text: messageText,
        roomId: selectedRoomId,
        reactions: {},
      };

      const tempId = `temp_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const optimisticMsg = {
        id: tempId,
        user_id: currentUser.id,
        message: dbPayload,
        created_at: nowIso,
        _parsed: parsedMemory,
      };

      setRawMessages((prev) => [...prev, optimisticMsg]);
      setLastChattedMap((prev) => ({ ...prev, [currentUser.id]: nowIso }));
      setInput("");
      setShowEmoji(false);

      const { data, error } = await supabase
        .from("global_messages")
        .insert({
          user_id: currentUser.id,
          message: dbPayload,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setRawMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data, _parsed: parsedMemory } : m))
        );
      }

      inputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Unsend note handler (with safety notice for all room participants)
  const handleDeleteMessage = async (messageId) => {
    if (!currentUser) return;
    try {
      const msg = rawMessages.find((m) => m.id === messageId);
      const parsed = msg ? parseMessageContent(msg) : {};
      const nowIso = new Date().toISOString();

      const updatedPayload = JSON.stringify({
        ...parsed,
        text: "",
        is_unsent: true,
        unsent_at: nowIso,
        roomId: selectedRoomId,
      });

      // Optimistic update
      setRawMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                message: updatedPayload,
                _parsed: {
                  ...parsed,
                  text: "",
                  is_unsent: true,
                  unsent_at: nowIso,
                  roomId: selectedRoomId,
                },
              }
            : m
        )
      );

      const { error } = await supabase
        .from("global_messages")
        .update({ message: updatedPayload })
        .eq("id", messageId);

      if (error) throw error;

      // Broadcast unsend event so other users see the unsend notice instantly
      supabase
        .channel("shotzi_global_chat")
        .send({
          type: "broadcast",
          event: "unsend",
          payload: {
            messageId,
            roomId: selectedRoomId,
            unsentAt: nowIso,
          },
        })
        .catch(() => {});

      toast.success("Note unsent.");
    } catch (error) {
      console.error("Error unsend note:", error);
      toast.error("Could not unsend note.");
    }
  };

  // Reaction handler
  const handleReact = (messageId, emoji) => {
    if (!currentUser) {
      openAuth("signin");
      return;
    }

    setRawMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          const currentParsed = parseMessageContent(msg);
          const reactions = { ...(currentParsed.reactions || {}) };
          const currentUsers = reactions[emoji] || [];
          if (currentUsers.includes(currentUser.id)) {
            reactions[emoji] = currentUsers.filter((id) => id !== currentUser.id);
          } else {
            reactions[emoji] = [...currentUsers, currentUser.id];
          }
          return {
            ...msg,
            _parsed: {
              ...currentParsed,
              reactions,
            },
          };
        }
        return msg;
      })
    );

    supabase
      .channel("shotzi_global_chat")
      .send({
        type: "broadcast",
        event: "reaction",
        payload: {
          messageId,
          emoji,
          userId: currentUser.id,
        },
      })
      .catch(() => {});
  };

  // Typing broadcast
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!currentUser) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      supabase
        .channel("shotzi_global_chat")
        .send({
          type: "broadcast",
          event: "typing",
          payload: {
            roomId: selectedRoomId,
            userId: currentUser.id,
            username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Someone",
          },
        })
        .catch(() => {});
    }, 400);
  };

  // Join request for private room
  const handleRequestToJoin = async () => {
    if (!currentUser) {
      openAuth("signin");
      return;
    }

    try {
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          roomId: activeRoom.id,
          userId: currentUser.id,
          username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0],
          display_name: currentUser.user_metadata?.display_name,
          avatar_url: currentUser.user_metadata?.avatar_url,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request.");

      toast.success(
        data.status === "joined"
          ? "You joined the room!"
          : "Request sent! The creator will review and accept your membership."
      );
      fetchRooms();
    } catch (err) {
      toast.error(err.message || "Failed to submit join request.");
    }
  };

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const q = searchQuery.toLowerCase();
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [rooms, searchQuery]);

  // Sorted community profiles
  const sortedCommunityProfiles = useMemo(() => {
    return [...onlineProfiles].sort((a, b) => {
      const aIsLive = livePresenceUserIds.has(a.id);
      const bIsLive = livePresenceUserIds.has(b.id);
      if (aIsLive && !bIsLive) return -1;
      if (!aIsLive && bIsLive) return 1;

      const aTime = a.last_active ? new Date(a.last_active).getTime() : 0;
      const bTime = b.last_active ? new Date(b.last_active).getTime() : 0;
      return bTime - aTime;
    });
  }, [onlineProfiles, livePresenceUserIds]);

  // Live online count
  const liveCount = useMemo(() => {
    let count = 0;
    sortedCommunityProfiles.forEach((p) => {
      const isLive = livePresenceUserIds.has(p.id);
      const status = formatExactLastSeen(p.last_active, isLive);
      if (status.isOnline) count++;
    });
    return Math.max(count, 1);
  }, [sortedCommunityProfiles, livePresenceUserIds]);

  // Computed active room members with online status and host badge
  const activeRoomMembers = useMemo(() => {
    if (activeRoom.id === "everyone") return [];
    const memberIds = Array.isArray(activeRoom.members) ? activeRoom.members : [];
    const allIds = Array.from(
      new Set(activeRoom.creator_id ? [activeRoom.creator_id, ...memberIds] : memberIds)
    );
    return allIds.map((id) => {
      const prof = profiles[id];
      const isRoomCreator = id === activeRoom.creator_id;
      const displayName =
        prof?.display_name ||
        prof?.username ||
        (isRoomCreator ? activeRoom.creator_username || "Curator" : "Member");
      const isLive = livePresenceUserIds.has(id);
      const status = formatExactLastSeen(prof?.last_active, isLive);
      return {
        id,
        isCreator: isRoomCreator,
        username: prof?.username,
        displayName,
        avatar_url: prof?.avatar_url,
        last_active: prof?.last_active,
        isLive,
        status,
      };
    });
  }, [activeRoom, profiles, livePresenceUserIds]);

  // Unauthenticated Banner View
  if (authLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-3 border-black border-t-[#FFD21E] rounded-full animate-spin" />
        <p className="font-bold text-sm text-zinc-600">Connecting to live rooms...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthBarrier
        title="Live Chat Rooms"
        subtitle="Sign in to join community rooms, hang out with fellow creators, and chat under the same sky."
        badge="MEMBERS ONLY • ROOMS"
        icon={<Globe className="w-7 h-7 text-black stroke-[2.5]" />}
      />
    );
  }

  const ActiveIconComponent = ROOM_ICONS[activeRoom.icon] || Globe;

  return (
    <div
      className={`w-full flex border-2 border-black bg-[#FAF7F0] shadow-[4px_4px_0px_#18181B] sm:shadow-[6px_6px_0px_#18181B] overflow-hidden transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none h-screen w-screen max-w-none m-0 shadow-none border-0"
          : "h-[calc(100dvh-85px)] sm:h-[calc(100vh-90px)] min-h-[460px] max-h-[calc(100vh-70px)] rounded-2xl sm:rounded-3xl"
      }`}
    >
      {/* Mobile Backdrop for Rooms Drawer */}
      {mobileRoomsOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileRoomsOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR: CHATS & ROOMS LIST */}
      {/* ========================================================================= */}
      <aside
        className={`w-64 lg:w-72 xl:w-80 flex flex-col border-r-2 border-black bg-white shrink-0 transition-all duration-200 ${
          mobileRoomsOpen
            ? "fixed inset-y-0 left-0 w-[85vw] max-w-[320px] z-[60] shadow-2xl md:static md:w-64 lg:w-72 xl:w-80 md:z-auto md:shadow-none"
            : "hidden md:flex"
        }`}
      >
        {/* Sidebar Header & Search */}
        <div className="p-3.5 border-b-2 border-black bg-[#FAF7F0] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FFD21E]" />
              Rooms & Corners
            </span>
            {mobileRoomsOpen && (
              <button
                type="button"
                onClick={() => setMobileRoomsOpen(false)}
                className="p-1 rounded-full border border-black hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search bar + Quick Create (+) Button */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-8 pr-3 py-1.5 rounded-full border-2 border-black bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B]"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="p-2 rounded-full border-2 border-black bg-[#FFD21E] hover:bg-[#ffe169] text-black shadow-[1.5px_1.5px_0px_#18181B] transition-transform active:scale-95"
              title="Create a Room"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Rooms Scrollable List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 soft-scroll">
          {filteredRooms.map((room) => {
            const isSelected = room.id === selectedRoomId;
            const IconComp = ROOM_ICONS[room.icon] || Globe;
            const isRoomPrivate = room.is_private;
            const pendingCount = room.pending_count || 0;

            return (
              <button
                key={room.id}
                type="button"
                onClick={() => handleSelectRoom(room.id)}
                className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                  isSelected
                    ? "bg-[#FFD21E] border-black shadow-[3px_3px_0px_#18181B] scale-[1.01]"
                    : "bg-white border-transparent hover:border-black hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {room.image_url ? (
                    <div className="w-8 h-8 rounded-xl border border-black overflow-hidden shrink-0 shadow-[1px_1px_0px_#18181B]">
                      <img src={room.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-white border-black text-black shadow-[1px_1px_0px_#18181B]"
                          : "bg-zinc-100 border-black/20 text-zinc-700 group-hover:border-black"
                      }`}
                    >
                      <IconComp className="w-4 h-4 stroke-[2.2]" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-black truncate block">
                        {room.name}
                      </span>
                      {isRoomPrivate && (
                        <Lock className="w-3 h-3 text-[#FF5376] shrink-0" title="Private Group" />
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-600 truncate mt-0.5 block">
                      {room.description || (isRoomPrivate ? "Private Group" : "Open chat")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#FF5376] text-white text-[9px] font-black border border-black shadow-[1px_1px_0px_#18181B]">
                      {pendingCount} req
                    </span>
                  )}
                  {isSelected && (
                    <ArrowRight className="w-3.5 h-3.5 text-black stroke-[3] ml-1 shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* "+ Create a Room" Button */}
        <div className="p-3 border-t-2 border-black bg-[#FAF7F0]">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full py-2.5 rounded-xl border-2 border-black bg-white hover:bg-zinc-100 text-black text-xs font-black flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#18181B] transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create a Room</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-black/10 flex items-center gap-2 text-zinc-500">
          <Sparkles className="w-4 h-4 text-[#FFD21E]" />
          <span className="font-serif italic text-xs text-zinc-700">
            Good people · Great conversations
          </span>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. CENTER COLUMN: ACTIVE CHAT ROOM & FOCUSED STREAM */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#FAF7F0] relative overflow-hidden">
        {/* Chat Room Header */}
        <header className="p-2 sm:p-2.5 md:p-3 border-b-2 border-black flex items-center justify-between gap-2 bg-white shadow-xs z-10 shrink-0 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-[120px] sm:min-w-[160px] flex-1">
            {/* Mobile Drawer Button */}
            <button
              type="button"
              onClick={() => setMobileRoomsOpen(true)}
              className="md:hidden p-1.5 rounded-xl border-2 border-black bg-white text-black shadow-[1.5px_1.5px_0px_#18181B] shrink-0"
              title="View Rooms"
            >
              <Menu className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Room Picture or Icon */}
            {activeRoom.image_url ? (
              <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-2xl border-2 border-black overflow-hidden shadow-[1.5px_1.5px_0px_#18181B] sm:shadow-[2px_2px_0px_#18181B] shrink-0">
                <img src={activeRoom.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center text-black shadow-[1.5px_1.5px_0px_#18181B] sm:shadow-[2px_2px_0px_#18181B] shrink-0">
                <ActiveIconComponent className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
            )}

            {/* Room Title & Subtitle */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="font-black text-sm sm:text-base md:text-lg text-black truncate leading-tight tracking-tight">
                  {activeRoom.name || "Room"}
                </h1>
                {activeRoom.is_private && (
                  <span className="inline-flex px-1.5 py-0.2 rounded-full bg-[#FF5376]/20 border border-[#FF5376] text-[#FF5376] text-[9px] font-black shrink-0">
                    Private
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-500 font-medium truncate block mt-0.5">
                {activeRoom.description || (activeRoom.is_private ? "Private Group" : "Open chat for all")}
              </p>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
            {/* Room Members count badge */}
            {activeRoom.id !== "everyone" && (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 1280) {
                    setMobileInfoOpen(true);
                  }
                }}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border-2 border-black bg-[#FFD21E] text-[11px] sm:text-xs font-black text-black shadow-[1.5px_1.5px_0px_#18181B] shrink-0 cursor-pointer"
                title="Room Members"
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>{(activeRoom.members?.length || 0)} <span className="hidden sm:inline">members</span></span>
              </button>
            )}

            {/* Real online count pill (hidden on smaller screens to keep header spacious) */}
            <div className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-black bg-[#FAF7F0] text-xs font-bold text-black shadow-[1.5px_1.5px_0px_#18181B] shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>{liveCount} online</span>
            </div>

            {/* Creator Approval Requests Badge Button */}
            {isCreator && (activeRoom.pending_requests?.length || 0) > 0 && (
              <button
                type="button"
                onClick={() => setIsRequestsModalOpen(true)}
                className="neo-btn neo-btn-yellow px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-black flex items-center gap-1 shadow-[1.5px_1.5px_0px_#18181B] animate-pulse cursor-pointer shrink-0"
                title="Review Join Requests"
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Requests</span>
                <span>({activeRoom.pending_requests.length})</span>
              </button>
            )}

            {/* Add Members / Invite Button */}
            {(activeRoom.id === "everyone" || isCreator) && (
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-full border-2 border-black bg-white hover:bg-zinc-100 text-black text-[11px] sm:text-xs font-black flex items-center gap-1 shadow-[1.5px_1.5px_0px_#18181B] transition-transform active:scale-95 cursor-pointer shrink-0"
                title={isCreator ? "Add & Manage Members" : "Share Invite Link"}
              >
                {isCreator ? (
                  <UserPlus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                )}
                <span className="hidden md:inline">
                  {isCreator ? "Add" : "Invite"}
                </span>
              </button>
            )}

            {/* Leave Room Button */}
            {activeRoom.id !== "everyone" && isMember && !isCreator && (
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="hidden sm:inline-flex p-1.5 sm:px-2.5 sm:py-1 rounded-full border-2 border-black bg-white hover:bg-zinc-100 text-zinc-800 text-[11px] sm:text-xs font-black items-center gap-1 shadow-[1.5px_1.5px_0px_#18181B] transition-transform active:scale-95 cursor-pointer shrink-0"
                title="Leave this room"
              >
                <LogOut className="w-3.5 h-3.5 stroke-[2.5] text-zinc-700 shrink-0" />
                <span className="hidden lg:inline">Leave</span>
              </button>
            )}

            {/* Finish / Delete Room Button */}
            {activeRoom.id !== "everyone" && isCreator && (
              <button
                type="button"
                onClick={handleDeleteRoom}
                className="hidden sm:inline-flex p-1.5 sm:px-2.5 sm:py-1 rounded-full border-2 border-black bg-[#FF5376] hover:bg-rose-600 text-white text-[11px] sm:text-xs font-black items-center gap-1 shadow-[1.5px_1.5px_0px_#18181B] transition-transform active:scale-95 cursor-pointer shrink-0"
                title="Finish and Delete Room Completely"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span className="hidden lg:inline">Finish</span>
              </button>
            )}

            {/* Focus / Fullscreen Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-full border-2 border-black bg-white hover:bg-zinc-100 text-black shadow-[1.5px_1.5px_0px_#18181B] transition-transform active:scale-95 shrink-0"
              title={isFullscreen ? "Exit Fullscreen Focus" : "Fullscreen Focus Mode"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              )}
            </button>

            {/* Mobile Community Toggle (Only shown for Everyone room since custom rooms use the 2 members pill) */}
            {activeRoom.id === "everyone" && (
              <button
                type="button"
                onClick={() => setMobileInfoOpen(!mobileInfoOpen)}
                className="xl:hidden p-1.5 sm:p-2 rounded-full border-2 border-black bg-white text-black shadow-[1.5px_1.5px_0px_#18181B] shrink-0"
                title="View Community"
              >
                <Sun className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}
          </div>
        </header>

        {/* Message Stream Area (Internal smooth scroll only, no outer page scroll) */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 soft-scroll bg-[#FAF7F0] relative">
          {!isMember ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#FF5376]/20 border-2 border-black text-[#FF5376] flex items-center justify-center shadow-[3px_3px_0px_#18181B]">
                <Lock className="w-8 h-8 stroke-[2.2]" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="font-black text-xl text-black">Private Room</h3>
                <p className="text-xs sm:text-sm text-zinc-600 font-medium">
                  This room is curated by <strong>@{activeRoom.creator_username || "creator"}</strong>.
                  Only the group creator can accept new people into this space.
                </p>
              </div>

              {hasPendingRequest ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#18181B]">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span>Request pending creator approval</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestToJoin}
                  className="neo-btn neo-btn-yellow px-6 py-2.5 text-xs font-black shadow-[3px_3px_0px_#18181B]"
                >
                  Request to Join Room
                </button>
              )}
            </div>
          ) : loadingMessages ? (
            <div className="py-20 text-center text-xs font-bold text-zinc-500 animate-pulse">
              Connecting to {activeRoom.name}...
            </div>
          ) : activeRoomMessages.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-white border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#18181B]">
                <Sparkles className="w-5 h-5 text-[#FFD21E]" />
              </div>
              <p className="font-black text-base text-black">Quiet for now.</p>
              <p className="text-xs text-zinc-500 font-medium">
                Be the first to share a thought in {activeRoom.name}.
              </p>
            </div>
          ) : (
            // Well-formatted grouped messages with date dividers
            groupedMessages.map((item) => {
              if (item.type === "divider") {
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-center my-4 select-none"
                  >
                    <div className="px-3 py-1 rounded-full border border-black/20 bg-white/80 backdrop-blur-xs text-[11px] font-black text-zinc-700 shadow-xs uppercase tracking-wider">
                      {item.label}
                    </div>
                  </div>
                );
              }

              return (
                <ChatMessageItem
                  key={item.msg.id}
                  message={item.msg}
                  currentUser={currentUser}
                  profile={profiles[item.msg.senderId]}
                  onDelete={handleDeleteMessage}
                  onReact={handleReact}
                  isRoomCreator={activeRoom.creator_id === item.msg.senderId}
                />
              );
            })
          )}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 animate-pulse mt-2 px-2">
              <span className="inline-block w-2 h-2 rounded-full bg-black animate-ping" />
              <span>
                {typingUsers.map((u) => u.username).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pure Text-Based Composer Bar */}
        {isMember && (
          <form
            onSubmit={handleSendMessage}
            className="relative p-3 sm:p-3.5 border-t-2 border-black bg-white flex items-center gap-2 shadow-sm shrink-0"
          >
            {/* WhatsApp-Grade Full Emoji Picker */}
            <EmojiPicker
              isOpen={showEmoji}
              onClose={() => setShowEmoji(false)}
              onSelectEmoji={(emoji) => {
                setInput((prev) => prev + emoji);
                inputRef.current?.focus();
              }}
              align="left"
            />

            {/* Pure Text Input with Emoji Button */}
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder={`Share a thought with everyone in ${activeRoom.name}...`}
                className="w-full h-11 pl-4 pr-10 rounded-full border-2 border-black bg-[#FAF7F0] text-xs sm:text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[2px_2px_0px_#18181B]"
              />
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer ${
                  showEmoji ? "text-black scale-110" : "text-zinc-500 hover:text-black"
                }`}
                title="WhatsApp Emojis"
              >
                <Smile className="w-5 h-5 stroke-[2]" />
              </button>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="w-11 h-11 rounded-full bg-[#FFD21E] hover:bg-[#ffe169] text-black border-2 border-black flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-[2px_2px_0px_#18181B] shrink-0 cursor-pointer"
              title="Send Message"
            >
              <Send className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>
        )}
      </main>

      {/* Mobile backdrop overlay to close sidebar cleanly when tapped on mobile */}
      {mobileInfoOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 xl:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileInfoOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. RIGHT SIDEBAR: REAL COMMUNITY & ROOM MEMBERS */}
      {/* ========================================================================= */}
      <aside
        className={`w-76 lg:w-80 border-l-2 border-black bg-white shrink-0 p-4 space-y-4 overflow-y-auto soft-scroll transition-all duration-200 ${
          mobileInfoOpen
            ? "fixed inset-y-0 right-0 w-[85vw] max-w-[320px] z-[60] shadow-2xl flex flex-col xl:static xl:w-76 lg:xl:w-80 xl:z-auto xl:shadow-none xl:flex"
            : "hidden xl:block"
        }`}
      >
        {mobileInfoOpen && (
          <div className="flex justify-end xl:hidden">
            <button
              type="button"
              onClick={() => setMobileInfoOpen(false)}
              className="p-1 rounded-full border border-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Room Members Section for Custom Rooms */}
        {activeRoom.id !== "everyone" && (
          <div className="space-y-3 pb-3 border-b-2 border-black/10">
            <div className="flex items-center justify-between pb-1.5 border-b border-black/10">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-black" />
                <span className="font-black text-xs uppercase tracking-wider text-black">
                  Room Members
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#FFD21E] text-black text-[10px] font-black border border-black/20">
                  {activeRoomMembers.length}
                </span>
              </div>
              {isCreator && (
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="text-[10px] font-black text-black hover:text-[#FF5376] flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ Add</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto soft-scroll pr-0.5">
              {activeRoomMembers.length === 0 ? (
                <p className="text-xs text-zinc-400 py-1 font-medium">No members yet.</p>
              ) : (
                activeRoomMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 p-2 rounded-xl border border-black/15 bg-[#FAF7F0] hover:border-black transition-all shadow-[1px_1px_0px_#18181B]"
                  >
                    <Link
                      href={m.username ? `/u/${m.username}` : "#"}
                      className="relative block shrink-0"
                    >
                      <div className="w-8 h-8 rounded-full border border-black overflow-hidden bg-[#FFD21E] flex items-center justify-center font-black text-xs text-black shadow-[1px_1px_0px_#18181B]">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{m.displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          m.status.isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                        }`}
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={m.username ? `/u/${m.username}` : "#"}
                          className="font-black text-xs text-black hover:text-[#FF5376] truncate block leading-tight"
                        >
                          {m.displayName}
                        </Link>
                        {m.isCreator && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black rounded-full bg-[#FF5376]/15 text-[#FF5376] border border-[#FF5376]/30 shrink-0">
                            Host
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold block ${
                          m.status.isOnline ? "text-emerald-700" : "text-zinc-500"
                        }`}
                      >
                        {m.status.text}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {isCreator && (
              <button
                type="button"
                onClick={handleDeleteRoom}
                className="w-full mt-1.5 py-1.5 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Finish & Delete Room</span>
              </button>
            )}
          </div>
        )}

        {/* Real Community Members Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/10">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xs uppercase tracking-wider text-black">
              Community
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-black/20">
              {liveCount} online
            </span>
          </div>
          <span className="text-[11px] font-bold text-zinc-400">
            {sortedCommunityProfiles.length} Curators
          </span>
        </div>

        {/* Real community members list with exact online status & last chatted date/time */}
        <div className="space-y-3">
          {sortedCommunityProfiles.length === 0 ? (
            <p className="text-xs text-zinc-400 py-2">Loading curators...</p>
          ) : (
            sortedCommunityProfiles.map((user) => {
              const displayName = user.display_name || user.username || "Curator";
              const isLive = livePresenceUserIds.has(user.id);
              const status = formatExactLastSeen(user.last_active, isLive);
              const lastChattedDate = lastChattedMap[user.id];
              const lastChattedText = formatLastChatted(lastChattedDate);

              return (
                <div
                  key={user.id}
                  className="p-2.5 rounded-2xl border border-black/15 bg-[#FAF7F0] hover:border-black transition-all shadow-[1px_1px_0px_#18181B] space-y-1.5"
                >
                  <div className="flex items-center gap-2.5">
                    {/* Avatar */}
                    <Link
                      href={`/u/${user.username || user.id}`}
                      className="relative block shrink-0"
                    >
                      <div className="w-9 h-9 rounded-full border border-black overflow-hidden bg-[#FFD21E] flex items-center justify-center font-black text-xs text-black shadow-[1px_1px_0px_#18181B]">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          status.isOnline
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-zinc-400"
                        }`}
                      />
                    </Link>

                    {/* Name & Online / Offline Status */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/u/${user.username || user.id}`}
                        className="font-black text-xs text-black hover:text-[#FF5376] truncate block leading-tight"
                      >
                        {displayName}
                      </Link>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={`text-[10px] font-bold ${
                            status.isOnline ? "text-emerald-700" : "text-zinc-500"
                          }`}
                        >
                          {status.text}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Exact Last Chatted Timestamp */}
                  <div className="pt-1 border-t border-black/5 flex items-center gap-1.5 text-[10px] text-zinc-600 font-medium">
                    <MessageSquare className="w-3 h-3 text-zinc-400 shrink-0" />
                    <span className="truncate">
                      {lastChattedText}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Today's Vibe Card */}
        <div className="p-4 rounded-2xl border-2 border-black bg-[#FFD21E] shadow-[3px_3px_0px_#18181B] space-y-2">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-black stroke-[2.5]" />
            <span className="font-black text-xs uppercase tracking-wider text-black">
              Today&apos;s Vibe
            </span>
          </div>
          <p className="font-serif italic text-sm text-black leading-relaxed">
            &ldquo;Same people, different stories, beautiful chaos.&rdquo;
          </p>
          <div className="text-right">
            <span className="font-serif text-lg text-black leading-none">♡</span>
          </div>
        </div>

        {/* Chat Guidelines Card */}
        <div className="p-4 rounded-2xl border-2 border-black bg-[#FAF7F0] shadow-[3px_3px_0px_#18181B] space-y-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-black stroke-[2.2]" />
            <span className="font-black text-xs uppercase tracking-wider text-black">
              Chat Guidelines
            </span>
          </div>
          <ul className="text-[11px] text-zinc-700 font-medium space-y-1.5 leading-tight">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" />
              <span>Be kind & respectful</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" />
              <span>No hate or harassment</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" />
              <span>Keep it safe & positive</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" />
              <span>Share, don&apos;t spam</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" />
              <span>Make friends, not enemies</span>
            </li>
          </ul>
          <div className="pt-2 border-t border-black/10 text-center">
            <span className="font-serif italic text-xs text-zinc-600">
              Good people here ♡
            </span>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 4. MODALS */}
      {/* ========================================================================= */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        currentUser={currentUser}
        onRoomCreated={(newRoom) => {
          fetchRooms();
          setSelectedRoomId(newRoom.id);
        }}
      />

      <RoomInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        room={activeRoom}
        currentUser={currentUser}
        onMembersUpdated={fetchRooms}
        communityProfiles={onlineProfiles}
      />

      <JoinRequestsModal
        isOpen={isRequestsModalOpen}
        onClose={() => setIsRequestsModalOpen(false)}
        room={activeRoom}
        currentUser={currentUser}
        onRequestReviewed={() => {
          fetchRooms();
        }}
      />
    </div>
  );
}
