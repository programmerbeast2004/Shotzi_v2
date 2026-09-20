"use client";

import { useEffect, useState } from "react";
import { supabase, getAuthUser } from "../lib/supabaseClient";
import { Search, UserCheck, MessageSquare } from "lucide-react";

export default function UsersDirectory({ onSelectUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const u = await getAuthUser();
      setCurrentUser(u);
    };
    getUser();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .neq("id", currentUser?.id)
          .order("username");

        if (error) throw error;
        setUsers(data || []);
        setLoading(false);
      } catch (error) {
        console.error("Error loading users:", error);
        setLoading(false);
      }
    };

    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

  const filteredUsers = users.filter((user) => {
    const q = search.toLowerCase();
    return (
      user.username?.toLowerCase().includes(q) ||
      user.display_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="p-4 border-b border-border/70 space-y-3">
        <h3 className="font-serif text-xl font-normal text-ink">Find Curators</h3>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username..."
            className="w-full h-8 pl-8 pr-3 rounded-full border border-border bg-surface-soft text-xs text-ink focus:bg-surface focus:border-accent focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40 soft-scroll">
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            Finding curators...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            No curators found.
          </div>
        ) : (
          filteredUsers.map((user) => {
            const displayName = user.display_name || user.username;
            return (
              <div
                key={user.id}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-surface-soft transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-surface-soft border border-border flex items-center justify-center font-serif text-xs font-bold text-accent shrink-0 overflow-hidden">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs text-ink truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-ink-muted font-mono truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectUser(user.id, user.username)}
                  className="px-3 py-1.5 rounded-full border border-border hover:border-accent/40 bg-surface-soft hover:bg-surface text-xs font-medium text-ink transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <MessageSquare className="w-3 h-3 text-accent" />
                  <span>Message</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
