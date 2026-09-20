"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { X, Check, UserX, Users, Shield } from "lucide-react";
import { useToast } from "./Toast";
import { authFetch } from "../lib/apiClient";

export default function JoinRequestsModal({
  isOpen,
  onClose,
  room,
  currentUser,
  onRequestReviewed,
}) {
  const [processingId, setProcessingId] = useState(null);
  const toast = useToast();

  if (!isOpen || !room) return null;

  const pendingRequests = room.pending_requests || [];

  const handleReview = async (targetUserId, decision) => {
    try {
      setProcessingId(targetUserId);
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_request",
          roomId: room.id,
          creatorId: currentUser?.id,
          targetUserId,
          decision,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to review request.");

      toast.success(
        decision === "approve"
          ? "User accepted into the room!"
          : "Request declined."
      );
      onRequestReviewed?.(room.id, data.pending_requests, data.members);
    } catch (error) {
      console.error("Review request error:", error);
      toast.error(error.message || "Failed to process request.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#FAF7F0] border-2 border-black rounded-3xl shadow-[6px_6px_0px_#18181B] p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FF5376] text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#18181B]">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-black text-xl text-black">Membership Requests</h2>
              <p className="text-xs text-zinc-600 font-medium">
                Review people waiting to join <span className="font-bold">{room.name}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full border-2 border-black bg-white hover:bg-zinc-100 transition-colors shadow-[1.5px_1.5px_0px_#18181B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice */}
        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium leading-relaxed">
          As the creator of this group, only <strong>you</strong> can accept new people into this group.
        </div>

        {/* Requests List */}
        <div className="mt-4 max-h-72 overflow-y-auto space-y-2.5 pr-1 soft-scroll">
          {pendingRequests.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white border-2 border-black flex items-center justify-center mx-auto text-zinc-400 shadow-[2px_2px_0px_#18181B]">
                <Users className="w-5 h-5" />
              </div>
              <p className="font-bold text-sm text-black">No pending requests</p>
              <p className="text-xs text-zinc-500">
                Share your room invite link to let friends request access.
              </p>
            </div>
          ) : (
            pendingRequests.map((req) => {
              const time = req.requested_at
                ? formatDistanceToNow(new Date(req.requested_at), { addSuffix: true })
                : "recently";
              const isProcessing = processingId === req.user_id;

              return (
                <div
                  key={req.user_id}
                  className="p-3 rounded-2xl bg-white border-2 border-black flex items-center justify-between gap-3 shadow-[2px_2px_0px_#18181B]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Link
                      href={`/u/${req.username}`}
                      className="w-9 h-9 rounded-full bg-[#FFD21E] border border-black flex items-center justify-center font-black text-xs text-black shrink-0 overflow-hidden"
                    >
                      {req.avatar_url ? (
                        <img
                          src={req.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{(req.display_name || req.username || "U").charAt(0).toUpperCase()}</span>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={`/u/${req.username}`}
                        className="font-black text-xs text-black hover:text-[#FF5376] truncate block"
                      >
                        {req.display_name || req.username}
                      </Link>
                      <span className="text-[10px] text-zinc-500 block">
                        @{req.username} · {time}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleReview(req.user_id, "reject")}
                      className="p-1.5 rounded-xl border border-black bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors disabled:opacity-50"
                      title="Decline"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleReview(req.user_id, "approve")}
                      className="neo-btn neo-btn-yellow px-2.5 py-1 text-xs font-black flex items-center gap-1 shadow-[1.5px_1.5px_0px_#18181B] disabled:opacity-50"
                      title="Accept into room"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Accept</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end border-t-2 border-black/10 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-full border-2 border-black bg-white hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_#18181B]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
