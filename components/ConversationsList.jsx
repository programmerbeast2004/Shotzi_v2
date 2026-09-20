"use client";

import { useEffect, useState } from "react";
import { supabase, getAuthUser } from "../lib/supabaseClient";
import { Search, MessageSquare, Sparkles } from "lucide-react";
import { formatLastSeen } from "./lastSeen";

export default function ConversationsList({ selectedUserId, onSelectUser }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const u = await getAuthUser();
      setUser(u);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      try {
        setLoading(true);

        const { data: messages, error } = await supabase
          .from("direct_messages")
          .select("sender_id, recipient_id")
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const partners = new Set();
        (messages || []).forEach((msg) => {
          const otherId =
            msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
          partners.add(otherId);
        });

        if (partners.size === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, last_active")
          .in("id", Array.from(partners));

        const convs = await Promise.all(
          (profiles || []).map(async (profile) => {
            const { count: unreadCount } = await supabase
              .from("direct_messages")
              .select("*", { count: "exact" })
              .eq("sender_id", profile.id)
              .eq("recipient_id", user.id)
              .eq("read", false);

            const { data: lastMsg } = await supabase
              .from("direct_messages")
              .select("content, created_at, sender_id")
              .or(
                `and(sender_id.eq.${user.id},recipient_id.eq.${profile.id}),and(sender_id.eq.${profile.id},recipient_id.eq.${user.id})`
              )
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            return {
              profile,
              unreadCount: unreadCount || 0,
              lastMessage: lastMsg?.content || "",
              lastMessageTime: lastMsg?.created_at || null,
            };
          })
        );

        convs.sort((a, b) => {
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        });

        setConversations(convs);
        setLoading(false);
      } catch (error) {
        console.error("Error loading conversations:", error);
        setLoading(false);
      }
    };

    loadConversations();

    const channel = supabase
      .channel("direct_messages_list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.profile.username?.toLowerCase().includes(q) ||
      c.profile.display_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header & search */}
      <div className="p-4 border-b border-border/70 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-normal text-ink">Conversations</h3>
          <span className="font-mono text-xs text-ink-muted">
            {conversations.length}
          </span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full h-8 pl-8 pr-3 rounded-full border border-border bg-surface-soft text-xs text-ink focus:bg-surface focus:border-accent focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40 soft-scroll">
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            Loading conversations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center space-y-1 text-ink-muted">
            <MessageSquare className="w-5 h-5 mx-auto mb-2 opacity-40 text-accent" />
            <p className="font-serif text-base text-ink font-normal">Your inbox is quiet.</p>
            <p className="text-xs text-ink-secondary">Select a photographer to start talking.</p>
          </div>
        ) : (
          filtered.map(({ profile, unreadCount, lastMessage }) => {
            const isSelected = selectedUserId === profile.id;
            const displayName = profile.display_name || profile.username;
            const status = formatLastSeen(profile.last_active);

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => onSelectUser(profile.id, profile.username)}
                className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors ${
                  isSelected
                    ? "bg-accent-soft/60 border-l-3 border-accent"
                    : "hover:bg-surface-soft"
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-surface-soft border border-border flex items-center justify-center font-serif text-sm font-bold text-accent overflow-hidden">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {status?.type === "online" && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-surface" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-xs text-ink truncate">
                      {displayName}
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[10px] font-bold shrink-0">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-muted truncate font-mono">
                    @{profile.username}
                  </p>
                  {lastMessage && (
                    <p className="text-xs text-ink-secondary truncate mt-0.5 leading-tight">
                      {lastMessage}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
