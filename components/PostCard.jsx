"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Trash2, MoreHorizontal, ShieldAlert, Camera } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { isAdmin } from "../lib/admin";
import { useAuthDrawer } from "./AuthDrawer";
import { isOnline } from "./lastSeen";

export default function PostCard({
  post,
  currentUser,
  initialLiked,
  initialLikeCount,
  initialCommentCount,
  onDeletePost,
  livePresenceUserIds,
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount || 0);
  const [busy, setBusy] = useState(false);
  const [isLikingAnim, setIsLikingAnim] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { openAuth } = useAuthDrawer();

  const createdAt = post.created_at ? new Date(post.created_at) : null;
  const profileSlug = post.profile_username || post.user_id;
  const isOwner = currentUser && currentUser.id === post.user_id;
  const isUserAdmin = currentUser && isAdmin(currentUser);

  // Check if author is online:
  // 1. Current logged-in user is author -> always online
  // 2. Realtime presence channel includes author's user_id -> online
  // 3. Author was active within last 2 minutes -> online
  const isAuthorOnline = Boolean(
    (currentUser && currentUser.id === post.user_id) ||
    (livePresenceUserIds && livePresenceUserIds.has(post.user_id)) ||
    isOnline(post.profile_last_active)
  );

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser) {
      openAuth("signin");
      return;
    }
    if (busy) return;
    setBusy(true);

    const willLike = !liked;
    setLiked(willLike);
    setLikeCount((prev) => (willLike ? prev + 1 : Math.max(0, prev - 1)));
    if (willLike) setIsLikingAnim(true);

    try {
      if (willLike) {
        await supabase.from("likes").insert({
          user_id: currentUser.id,
          post_id: post.id,
        });
      } else {
        await supabase
          .from("likes")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("post_id", post.id);
      }
    } catch (err) {
      // Revert if error
      setLiked(!willLike);
      setLikeCount((prev) => (!willLike ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setBusy(false);
      setTimeout(() => setIsLikingAnim(false), 400);
    }
  };

  return (
    <article className="group relative bg-white border-2 border-black rounded-2xl overflow-hidden flex flex-col transition-all duration-200 shadow-[2px_2px_0px_#18181B] sm:shadow-[3.5px_3.5px_0px_#18181B] hover:-translate-y-0.5 sm:hover:-translate-y-1 hover:shadow-[4px_4px_0px_#18181B] sm:hover:shadow-[6px_6px_0px_#18181B]">
      {/* Image container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-100 border-b-2 border-black">
        <Link href={`/post/${post.id}`} className="block w-full h-full relative">
          {/* Skeleton placeholder while image loads */}
          {!imgLoaded && (
            <div className="absolute inset-0 bg-zinc-200 animate-pulse flex items-center justify-center">
              <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-400 stroke-[1.5]" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
            </div>
          )}
          <img
            src={post.image_url}
            alt={post.caption || "Shotzi shot"}
            className={`h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
          />
          {/* Subtle gradient vignette at bottom for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
        </Link>

        {/* Creator tag badge with Neo-Pill styling and Online status dot */}
        <Link
          href={`/profile/${profileSlug}`}
          className="absolute top-2 left-2 sm:top-3 sm:left-3 max-w-[85%] inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/95 backdrop-blur-xs border-[1.5px] sm:border-2 border-black text-[10px] sm:text-[11px] font-black text-black shadow-[1.5px_1.5px_0px_#18181B] sm:shadow-[2px_2px_0px_#18181B] hover:bg-[#FFD21E] transition-all z-10"
        >
          {/* Online turns green (#22C55E), otherwise offline stays yellow (#FFD21E) */}
          <span
            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-black shrink-0 transition-colors duration-200 ${
              isAuthorOnline
                ? "bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.7)]"
                : "bg-[#FFD21E]"
            }`}
            title={isAuthorOnline ? "Online now" : "Offline"}
          />
          <span className="truncate max-w-[70px] xs:max-w-[90px] sm:max-w-[130px]">@{profileSlug}</span>
        </Link>
      </div>

      {/* Card Information */}
      <div className="p-2.5 sm:p-3.5 flex flex-col justify-between flex-1 gap-1.5 sm:gap-2.5">
        {post.caption && (
          <p className="text-[11px] sm:text-xs md:text-sm text-zinc-900 font-bold line-clamp-2 leading-snug break-words overflow-wrap-anywhere">
            {post.caption}
          </p>
        )}

        <div className="flex items-center justify-between gap-1 sm:gap-2 pt-1.5 sm:pt-2 border-t-2 border-black/10 text-xs text-zinc-700">
          {/* Interaction buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Like button with lively micro-interaction */}
            <button
              type="button"
              onClick={handleLike}
              disabled={busy}
              aria-label={liked ? "Unlike shot" : "Like shot"}
              className={`inline-flex items-center gap-1 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black border-[1.5px] sm:border-2 border-black transition-all duration-150 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer shrink-0 ${
                liked
                  ? "bg-[#FF5376] text-white shadow-[1px_1px_0px_#18181B] sm:shadow-[1.5px_1.5px_0px_#18181B]"
                  : "bg-white hover:bg-[#FFD21E] text-black shadow-[1px_1px_0px_#18181B] sm:shadow-[1.5px_1.5px_0px_#18181B]"
              }`}
            >
              <Heart
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 transition-transform duration-200 ${
                  liked ? "fill-white text-white" : "text-black"
                } ${isLikingAnim ? "scale-125" : "scale-100"}`}
              />
              <span className="text-[10px] sm:text-[11px] font-mono leading-none">{likeCount}</span>
            </button>

            {/* Comment button */}
            <Link
              href={`/post/${post.id}`}
              className="inline-flex items-center gap-1 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-white hover:bg-[#FFD21E] border-[1.5px] sm:border-2 border-black text-black shadow-[1px_1px_0px_#18181B] sm:shadow-[1.5px_1.5px_0px_#18181B] transition-all active:translate-x-0.5 active:translate-y-0.5 shrink-0"
              aria-label="View comments"
            >
              <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-mono leading-none">{initialCommentCount || 0}</span>
            </Link>
          </div>

          {/* Timestamp and More/Delete menu */}
          <div className="flex items-center justify-end gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] text-zinc-500 font-bold min-w-0 flex-1">
            {createdAt && (
              <span className="truncate max-w-[44px] xs:max-w-[70px] sm:max-w-none text-right">
                {formatDistanceToNow(createdAt, { addSuffix: false })}
              </span>
            )}

            {(isOwner || isUserAdmin) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 bottom-full mb-1 w-36 bg-surface border border-border rounded-xl shadow-lg p-1 z-30 animate-fade-in">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDeletePost && onDeletePost(post.id);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-danger hover:bg-danger-soft rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isUserAdmin && !isOwner ? "Admin Delete" : "Delete shot"}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
