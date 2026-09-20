"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Share2,
  Globe,
  Lock,
  Search,
  UserPlus,
  Users,
  Shield,
  Trash2,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "./Toast";
import { isAdmin } from "../lib/admin";
import { authFetch } from "../lib/apiClient";

export default function RoomInviteModal({
  isOpen,
  onClose,
  room,
  currentUser,
  onMembersUpdated,
  communityProfiles = [],
}) {
  const [tab, setTab] = useState("add"); // "add" | "members" | "link"
  const [search, setSearch] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const isMasterAdmin = Boolean(currentUser && isAdmin(currentUser));
  const isCreator = Boolean(
    isMasterAdmin || (currentUser && room && room.creator_id === currentUser.id)
  );

  // Fetch registered profiles for the creator to add
  useEffect(() => {
    if (!isOpen || !room) return;

    let ignore = false;
    async function loadUsers() {
      try {
        setLoadingUsers(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, last_active")
          .order("username", { ascending: true })
          .limit(100);

        if (!error && data && !ignore) {
          setUsersList(data);
        }
      } catch (err) {
        console.warn("Error loading profiles for room add:", err);
      } finally {
        if (!ignore) setLoadingUsers(false);
      }
    }

    loadUsers();
    return () => {
      ignore = true;
    };
  }, [isOpen, room]);

  if (!isOpen || !room) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${origin}/chat/global?room=${encodeURIComponent(
    room.id
  )}&invite=${encodeURIComponent(room.invite_code || room.id)}`;

  const currentMembers = Array.isArray(room.members) ? room.members : [];

  // Filter users by search
  const filteredUsers = usersList.filter((u) => {
    if (u.id === currentUser?.id) return false; // don't show self
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q)
    );
  });

  // Handle sending official invite notification (gives user the choice to Accept or Decline)
  const handleSendInvite = async (targetUser) => {
    if (!isCreator) {
      toast.error("Only the room creator or master admin can invite members.");
      return;
    }

    try {
      setProcessingId(targetUser.id);
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite_member",
          roomId: room.id,
          creatorId: currentUser.id,
          targetUserId: targetUser.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invitation.");

      toast.success(
        `Invitation sent to @${targetUser.username || targetUser.display_name}! They will get a notification to accept or decline.`
      );
      room.pending_invites = data.pending_invites || [...(room.pending_invites || []), targetUser.id];
      onMembersUpdated?.();
    } catch (err) {
      toast.error(err.message || "Could not send invitation.");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle direct addition of member by room creator or master admin
  const handleAddMember = async (targetUser) => {
    if (!isCreator) {
      toast.error("Only the room creator can add members.");
      return;
    }

    try {
      setProcessingId(targetUser.id);
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_member",
          roomId: room.id,
          creatorId: currentUser.id,
          targetUserId: targetUser.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add member.");

      toast.success(
        `Added @${targetUser.username || targetUser.display_name} to ${room.name}!`
      );
      room.members = data.members;
      onMembersUpdated?.();
    } catch (err) {
      toast.error(err.message || "Could not add member.");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle removing a member by room creator
  const handleRemoveMember = async (targetUserId, targetName) => {
    if (!isCreator) {
      toast.error("Only the room creator can remove members.");
      return;
    }

    try {
      setProcessingId(targetUserId);
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_member",
          roomId: room.id,
          creatorId: currentUser.id,
          targetUserId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member.");

      toast.success(`Removed @${targetName} from ${room.name}.`);
      room.members = data.members;
      onMembersUpdated?.();
    } catch (err) {
      toast.error(err.message || "Could not remove member.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const input = document.createElement("input");
        input.value = inviteUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      toast.success("Invite link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#FAF7F0] border-[3px] border-black rounded-3xl shadow-[8px_8px_0px_#18181B] p-5 sm:p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#18181B] shrink-0">
              <UserPlus className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-lg sm:text-xl text-black truncate">
                Manage Members · {room.name}
              </h2>
              <p className="text-xs text-zinc-600 font-medium truncate">
                {isCreator
                  ? "You are the creator. Only you can add new members."
                  : `Curated by @${room.creator_username || "creator"}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full border-2 border-black bg-white hover:bg-zinc-100 transition-colors shadow-[1.5px_1.5px_0px_#18181B] shrink-0 ml-2"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Creator Authority Banner */}
        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-2 shrink-0">
          <Shield className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            {isCreator
              ? "Official authority: As creator, you decide who enters and stays in this room."
              : "Only the group creator has authority to add new members."}
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex items-center gap-1.5 border-b-2 border-black/10 pb-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setTab("add")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all flex items-center gap-1.5 ${
              tab === "add"
                ? "bg-[#FFD21E] border-black shadow-[2px_2px_0px_#000]"
                : "bg-white border-transparent hover:border-black"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Members</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("members")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all flex items-center gap-1.5 ${
              tab === "members"
                ? "bg-[#FFD21E] border-black shadow-[2px_2px_0px_#000]"
                : "bg-white border-transparent hover:border-black"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({currentMembers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("link")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all flex items-center gap-1.5 ${
              tab === "link"
                ? "bg-[#FFD21E] border-black shadow-[2px_2px_0px_#000]"
                : "bg-white border-transparent hover:border-black"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Invite Link</span>
          </button>
        </div>

        {/* Tab 1: Direct Add Members by Creator */}
        {tab === "add" && (
          <div className="mt-3 flex-1 flex flex-col min-h-0">
            {/* Search Input */}
            <div className="relative mb-2.5 shrink-0">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Shotzi users by name or @username..."
                className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-xl border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#000]"
              />
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 soft-scroll min-h-[160px]">
              {loadingUsers ? (
                <div className="py-8 text-center text-xs font-bold text-zinc-500 animate-pulse">
                  Loading creators...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-zinc-500">
                  No users found matching "{search}".
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const alreadyMember = currentMembers.includes(u.id);
                  const isBusy = processingId === u.id;

                  return (
                    <div
                      key={u.id}
                      className="p-2.5 rounded-2xl bg-white border-2 border-black flex items-center justify-between gap-2 shadow-[2px_2px_0px_#000]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full border border-black bg-[#FFEAA7] flex items-center justify-center font-black text-xs text-black shrink-0 overflow-hidden">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (u.username || "U")[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-xs text-black truncate leading-tight">
                            {u.display_name || u.username}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-bold truncate">
                            @{u.username}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {alreadyMember ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Member</span>
                          </span>
                        ) : isCreator ? (
                          <>
                            {room.pending_invites?.includes(u.id) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                                <span>⏳ Invited</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSendInvite(u)}
                                className="neo-btn neo-btn-yellow px-2.5 py-1 text-[11px] font-black shadow-[1.5px_1.5px_0px_#000] disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                title="Send invite notification (user can accept or decline)"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>{isBusy ? "Sending..." : "Invite"}</span>
                              </button>
                            )}

                            {isCreator && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAddMember(u)}
                                className="px-2 py-1 rounded-lg border border-black bg-white hover:bg-zinc-100 text-[10px] font-black text-black shadow-[1px_1px_0px_#000] disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                title="Add directly to the room immediately"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-bold">
                            Creator only
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Current Members View & Manage */}
        {tab === "members" && (
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 soft-scroll min-h-[180px]">
            {currentMembers.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-zinc-500">
                No members joined yet.
              </div>
            ) : (
              currentMembers.map((memberId) => {
                const memberProfile = usersList.find((u) => u.id === memberId) || {
                  id: memberId,
                  username: memberId === room.creator_id ? (room.creator_username || "Creator") : "Member",
                  display_name: memberId === room.creator_id ? (room.creator_username || "Creator") : "Member",
                };
                const isThisCreator = memberId === room.creator_id;
                const isBusy = processingId === memberId;

                return (
                  <div
                    key={memberId}
                    className="p-2.5 rounded-2xl bg-white border-2 border-black flex items-center justify-between gap-2 shadow-[2px_2px_0px_#000]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full border border-black bg-[#FFD21E] flex items-center justify-center font-black text-xs text-black shrink-0 overflow-hidden">
                        {memberProfile.avatar_url ? (
                          <img
                            src={memberProfile.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (memberProfile.username || "M")[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-black text-xs text-black truncate">
                            {memberProfile.display_name || memberProfile.username}
                          </p>
                          {isThisCreator && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[#FFD21E] text-black text-[9px] font-black border border-black">
                              CREATOR
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold truncate">
                          @{memberProfile.username}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isCreator && !isThisCreator ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleRemoveMember(
                              memberId,
                              memberProfile.username || memberProfile.display_name
                            )
                          }
                          className="px-2.5 py-1 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                          title="Remove from room"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{isBusy ? "..." : "Remove"}</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Shareable Invite Link */}
        {tab === "link" && (
          <div className="mt-3 flex-1 flex flex-col justify-between space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                Shareable Invite Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white border-2 border-black rounded-xl text-zinc-700 select-all overflow-ellipsis shadow-[2px_2px_0px_#18181B]"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="neo-btn neo-btn-yellow px-4 py-2 text-xs font-black flex items-center gap-1.5 shrink-0 shadow-[2px_2px_0px_#18181B] cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              {room.is_private ? (
                <p>
                  🔒 <strong>Private Group:</strong> When someone uses this link, they submit a join request.
                  As creator, only <strong>you</strong> have the authority to accept them into this room.
                </p>
              ) : (
                <p>
                  🌐 <strong>Public Group:</strong> Anyone with this link can join and chat with the group.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-black rounded-full border-2 border-black bg-white hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_#18181B] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
