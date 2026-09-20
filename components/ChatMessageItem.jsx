"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Trash2, SmilePlus, Check, Star, Plus, Ban } from "lucide-react";
import { isAdmin } from "../lib/admin";
import EmojiPicker from "./EmojiPicker";

import { parseSafeDate } from "../lib/dateUtils";

export default function ChatMessageItem({
  message,
  currentUser,
  profile,
  onDelete,
  onReact,
  isRoomCreator = false,
}) {
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const reactPickerRef = useRef(null);

  // Close reaction bubble when clicking outside
  useEffect(() => {
    if (!showReactPicker) return;
    const handleClickOutside = (e) => {
      if (reactPickerRef.current && !reactPickerRef.current.contains(e.target)) {
        setShowReactPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showReactPicker]);

  // Dynamic perspective alignment based on currentUser.id
  const senderId = message.senderId || message.user_id || message.sender_id;
  const isOwnMessage = Boolean(currentUser && senderId === currentUser.id);

  const senderUsername = profile?.username || senderId?.slice(0, 8) || "user";
  const senderDisplayName = profile?.display_name || senderUsername;

  // Format exact time and full date/time tooltip
  let formattedTime = "";
  let fullDateTimeTooltip = "";
  const timeValue = message.createdAt || message.created_at;
  if (timeValue) {
    try {
      const date = parseSafeDate(timeValue);
      formattedTime = format(date, "h:mm a");
      fullDateTimeTooltip = format(date, "EEEE, MMMM d, yyyy 'at' h:mm:ss a");
    } catch {
      formattedTime = "";
      fullDateTimeTooltip = "";
    }
  }

  // Reactions map: { "❤️": ["userId1", ...], ... }
  const reactions = message.reactions || {};
  const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const handleReactionClick = (emoji) => {
    if (!currentUser) return;
    onReact?.(message.id, emoji);
    setShowReactPicker(false);
  };

  const isUnsent = Boolean(
    message.is_unsent ||
    message.isUnsent ||
    message.message?.startsWith("::shotzi_unsent::") ||
    message.text?.startsWith("::shotzi_unsent::")
  );

  return (
    <div
      className={`group w-full flex gap-2.5 sm:gap-3 my-1.5 transition-all duration-200 ${
        isOwnMessage ? "justify-end" : "justify-start"
      }`}
    >
      {/* SENDER AVATAR (Left-side only, for other users' messages) */}
      {!isOwnMessage && (
        <Link
          href={`/u/${senderUsername}`}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#FFD21E] border-2 border-black overflow-hidden shrink-0 shadow-[1.5px_1.5px_0px_#18181B] hover:scale-105 transition-transform flex items-center justify-center mt-1"
          title={`@${senderUsername} — ${fullDateTimeTooltip}`}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={senderDisplayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-black text-xs text-black">
              {senderDisplayName.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>
      )}

      {/* MESSAGE BODY CONTAINER */}
      <div
        className={`flex flex-col max-w-[85%] sm:max-w-[72%] md:max-w-[65%] ${
          isOwnMessage ? "items-end" : "items-start"
        }`}
      >
        {/* HEADER: SENDER NAME & EXACT TIME (For other users) */}
        {!isOwnMessage && (
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <Link
              href={`/u/${senderUsername}`}
              className="font-bold text-xs text-black hover:text-[#FF5376] flex items-center gap-1 transition-colors"
            >
              <span>{senderDisplayName}</span>
              {isRoomCreator && (
                <Star
                  className="w-3 h-3 text-[#FFD21E] fill-[#FFD21E] stroke-black stroke-1"
                  title="Room Creator"
                />
              )}
            </Link>
            <span
              className="text-[10px] text-zinc-500 font-medium cursor-help"
              title={fullDateTimeTooltip}
            >
              {formattedTime}
            </span>
          </div>
        )}

        {/* MESSAGE BUBBLE (OR UNSENT NOTICE) */}
        {isUnsent ? (
          <div
            title={fullDateTimeTooltip}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs italic text-zinc-500 rounded-2xl border shadow-2xs select-none ${
              isOwnMessage
                ? "bg-zinc-100 border-black/20 rounded-tr-xs"
                : "bg-zinc-100/90 border-black/15 rounded-tl-xs"
            }`}
          >
            <Ban className="w-3.5 h-3.5 text-zinc-400 shrink-0 stroke-[2]" />
            <span>{isOwnMessage ? "You unsent a note" : "This note was unsent"}</span>
          </div>
        ) : (
          <div
            title={fullDateTimeTooltip}
            className={`relative px-4 py-2.5 sm:px-4.5 sm:py-3 text-xs sm:text-sm leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap transition-shadow ${
              isOwnMessage
                ? "bg-[#FFD21E] text-black border-2 border-black rounded-2xl rounded-tr-xs shadow-[2px_2px_0px_#18181B]"
                : "bg-[#FAF7F0] text-black border-2 border-black/85 rounded-2xl rounded-tl-xs shadow-[2px_2px_0px_rgba(24,24,27,0.06)]"
            }`}
          >
            {message.text || message.message || message.content}
          </div>
        )}

        {/* FOOTER: EXACT TIMESTAMP (Own message) & REACTIONS & ACTIONS */}
        <div
          className={`flex items-center gap-1.5 mt-1 px-1 flex-wrap ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}
        >
          {/* Own timestamp with full date tooltip and delivery checkmark */}
          {isOwnMessage && (
            <span
              className="text-[10px] text-zinc-500 font-semibold inline-flex items-center gap-1 mr-1 cursor-help"
              title={fullDateTimeTooltip}
            >
              {formattedTime}
              <Check className="w-3 h-3 text-zinc-700 stroke-[2.5]" />
            </span>
          )}

          {/* Reactions only shown if message is NOT unsent */}
          {!isUnsent &&
            Object.entries(reactions).map(([emoji, userIds]) => {
              if (!userIds || userIds.length === 0) return null;
              const hasReacted = currentUser && userIds.includes(currentUser.id);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReactionClick(emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                    hasReacted
                      ? "bg-[#FFD21E]/30 border-black text-black shadow-[1px_1px_0px_#18181B]"
                      : "bg-white border-black/30 hover:border-black text-zinc-700 hover:bg-zinc-50"
                  }`}
                  title={`${userIds.length} reaction${userIds.length > 1 ? "s" : ""}`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px]">{userIds.length}</span>
                </button>
              );
            })}

          {/* Quick React "+" Button & Full Picker (only if NOT unsent) */}
          {!isUnsent && (
            <div className="relative" ref={reactPickerRef}>
              <button
                type="button"
                onClick={() => {
                  setShowReactPicker(!showReactPicker);
                  setShowFullPicker(false);
                }}
                className="w-6 h-6 rounded-full bg-white border border-black/30 hover:border-black text-zinc-600 hover:text-black flex items-center justify-center transition-colors text-xs opacity-70 group-hover:opacity-100 cursor-pointer"
                title="Add reaction"
              >
                <SmilePlus className="w-3.5 h-3.5" />
              </button>

              {/* WhatsApp Reaction Bubble */}
              {showReactPicker && (
                <div
                  className={`absolute bottom-8 z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-white border-2 border-black shadow-[3px_3px_0px_#18181B] animate-in fade-in zoom-in-90 duration-150 ${
                    isOwnMessage ? "right-0" : "left-0"
                  }`}
                >
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReactionClick(emoji)}
                      className="p-1 text-base sm:text-lg hover:scale-130 transition-transform active:scale-95 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setShowFullPicker(true);
                      setShowReactPicker(false);
                    }}
                    className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-[#FFD21E] border border-black/30 flex items-center justify-center text-zinc-600 hover:text-black transition-all hover:scale-110 active:scale-95 ml-0.5 cursor-pointer"
                    title="More WhatsApp emojis"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                  </button>
                </div>
              )}

              {/* WhatsApp Full Category & Search Emoji Picker */}
              <EmojiPicker
                isOpen={showFullPicker}
                onClose={() => setShowFullPicker(false)}
                onSelectEmoji={(emoji) => {
                  handleReactionClick(emoji);
                  setShowFullPicker(false);
                }}
                align={isOwnMessage ? "right" : "left"}
              />
            </div>
          )}

          {/* Unsend Message Action (Own message or Admin) */}
          {(isOwnMessage || isAdmin(currentUser)) && onDelete && !isUnsent && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-600 p-1 transition-opacity ml-1 cursor-pointer"
              title={isOwnMessage ? "Unsend note" : "Remove note (Admin)"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
