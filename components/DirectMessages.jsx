"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase, getAuthUser } from "../lib/supabaseClient";
import { formatExactLastSeen } from "./lastSeen";
import {
  Send,
  ArrowLeft,
  Smile,
  ShieldAlert,
  Sparkles,
  Search,
  MoreVertical,
  CheckCheck,
  User,
} from "lucide-react";
import { useToast } from "./Toast";
import EmojiPicker from "./EmojiPicker";

export default function DirectMessages({ selectedUserId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const getUser = async () => {
      const u = await getAuthUser();
      setUser(u);
    };
    getUser();
  }, []);

  // Fetch partner profile
  useEffect(() => {
    if (!selectedUserId) return;
    async function loadPartner() {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, last_active")
        .eq("id", selectedUserId)
        .maybeSingle();
      setPartnerProfile(data || null);
    }
    loadPartner();
  }, [selectedUserId]);

  // Load messages for this conversation
  useEffect(() => {
    if (!user || !selectedUserId) return;

    const broadcastRead = (partnerId) => {
      try {
        const payload = { userId: user.id, partnerId, ts: Date.now() };
        window.localStorage.setItem("shotzi_message_update", JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent("shotzi_message_update_local", { detail: payload }));
      } catch (err) {}
    };

    const loadMessages = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("direct_messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},recipient_id.eq.${user.id})`
          )
          .order("created_at", { ascending: true });

        if (error) throw error;
        setMessages(data || []);

        // Mark messages as read
        if (data && data.length > 0) {
          const unreadIds = data
            .filter((m) => m.recipient_id === user.id && !m.read)
            .map((m) => m.id);

          if (unreadIds.length > 0) {
            await supabase
              .from("direct_messages")
              .update({ read: true })
              .in("id", unreadIds);

            broadcastRead(selectedUserId);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading messages:", error);
        setLoading(false);
      }
    };

    loadMessages();

    // Subscribe to new messages in this conversation
    const channel = supabase
      .channel(`direct_messages_${user.id}_${selectedUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.new.sender_id === selectedUserId) {
            setMessages((prev) => [...prev, payload.new]);

            await supabase
              .from("direct_messages")
              .update({ read: true })
              .eq("id", payload.new.id);

            broadcastRead(selectedUserId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUserId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending || !user || !selectedUserId) return;

    try {
      setSending(true);
      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: user.id,
          recipient_id: selectedUserId,
          content: input.trim(),
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) => [...prev, data]);
      setInput("");
      setShowEmoji(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleEmojiClick = (emoji) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  if (!selectedUserId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-surface">
        <div className="w-14 h-14 rounded-2xl bg-surface-soft border border-border flex items-center justify-center text-accent mb-3">
          <User className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h3 className="font-serif text-2xl font-normal text-ink">Private Notes</h3>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1 max-w-sm">
          Select a photographer from the list or find someone new to exchange quiet conversations.
        </p>
      </div>
    );
  }

  const partnerDisplay = partnerProfile?.display_name || selectedUsername || "Photographer";
  const status = formatLastSeen(partnerProfile?.last_active);

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Conversation Header */}
      <div className="p-4 border-b border-border/70 flex items-center justify-between bg-surface">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-surface-soft border border-border flex items-center justify-center font-serif text-sm font-bold text-accent overflow-hidden">
              {partnerProfile?.avatar_url ? (
                <img
                  src={partnerProfile.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{partnerDisplay.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {status?.type === "online" && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-surface" />
            )}
          </div>

          <div>
            <Link
              href={`/u/${partnerProfile?.username || selectedUsername}`}
              className="font-medium text-sm text-ink hover:text-accent transition-colors block"
            >
              {partnerDisplay}
            </Link>
            <p className="text-[11px] text-ink-muted">
              {status?.text || `@${partnerProfile?.username || selectedUsername}`}
            </p>
          </div>
        </div>

        <Link
          href={`/u/${partnerProfile?.username || selectedUsername}`}
          className="text-xs text-ink-secondary hover:text-ink font-medium px-3 py-1 rounded-full border border-border bg-surface-soft hover:bg-surface transition-colors"
        >
          View Roll
        </Link>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 soft-scroll">
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center space-y-1 text-ink-muted">
            <p className="font-serif text-lg text-ink font-normal">Start of something quiet.</p>
            <p className="text-xs text-ink-secondary">Send a first note to break the silence.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            const time = msg.created_at
              ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })
              : "";

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words overflow-wrap-anywhere ${
                    isMe
                      ? "bg-accent text-white rounded-br-xs shadow-xs"
                      : "bg-surface-soft border border-border text-ink rounded-bl-xs"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-ink-muted mt-1 px-1">
                  {time}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <form
        onSubmit={handleSendMessage}
        className="relative p-3 sm:p-4 border-t border-border/70 flex items-center gap-2 bg-surface"
      >
        <EmojiPicker
          isOpen={showEmoji}
          onClose={() => setShowEmoji(false)}
          onSelectEmoji={(emoji) => {
            setInput((prev) => prev + emoji);
            inputRef.current?.focus();
          }}
          align="left"
        />

        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
            showEmoji ? "text-ink bg-surface-soft" : "text-ink-muted hover:text-ink hover:bg-surface-soft"
          }`}
          title="WhatsApp Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message @${partnerProfile?.username || selectedUsername}...`}
          className="flex-1 h-10 px-4 rounded-full border border-border bg-surface-soft text-xs sm:text-sm text-ink focus:bg-surface focus:border-accent focus:outline-none transition-all"
        />

        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
