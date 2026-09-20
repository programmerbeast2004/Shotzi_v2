"use client";

import Link from "next/link";
import PostCard from "./PostCard";
import SkeletonCard from "./SkeletonCard";
import { Camera, Plus } from "lucide-react";

export default function PostGrid({
  posts,
  currentUser,
  likedPostIds,
  likeCountMap,
  commentCountMap,
  onDeletePost,
  loading = false,
  livePresenceUserIds,
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 md:gap-5 lg:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!posts?.length) {
    return (
      <div className="bg-surface border border-border rounded-3xl py-16 px-6 text-center max-w-lg mx-auto my-12 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-surface-soft border border-border flex items-center justify-center mx-auto mb-4 text-accent">
          <Camera className="w-7 h-7 stroke-[1.5]" />
        </div>
        <h3 className="font-serif text-2xl text-ink font-normal mb-2">
          Nothing here yet.
        </h3>
        <p className="text-sm text-ink-secondary mb-6 max-w-sm mx-auto leading-relaxed">
          Every good camera roll starts somewhere. Share a sunset, street corner, or tiny detail.
        </p>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white hover:bg-accent-hover text-sm font-medium transition-all duration-200 shadow-xs active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Dump a shot</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 md:gap-5 lg:gap-6">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          initialLiked={likedPostIds?.includes(post.id)}
          initialLikeCount={likeCountMap?.[post.id] || 0}
          initialCommentCount={commentCountMap?.[post.id] || 0}
          onDeletePost={onDeletePost}
          livePresenceUserIds={livePresenceUserIds}
        />
      ))}
    </div>
  );
}
