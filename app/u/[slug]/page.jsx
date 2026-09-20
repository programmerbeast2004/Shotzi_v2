"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PostGrid from "../../../components/PostGrid";
import ProfileHeader from "../../../components/ProfileHeader";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { isAdmin } from "../../../lib/admin";
import { executeAdminDelete } from "../../../lib/adminService";
import { supabase, getAuthUser } from "../../../lib/supabaseClient";
import { useToast } from "../../../components/Toast";
import { Shield, Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AuthBarrier from "../../../components/AuthBarrier";

export default function PublicProfilePage() {
  const { slug } = useParams();
  const router = useRouter();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [likeCountMap, setLikeCountMap] = useState({});
  const [commentCountMap, setCommentCountMap] = useState({});
  const [likedPostIds, setLikedPostIds] = useState([]);

  // Follow states
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Dialog State
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmWord: "",
    action: null,
  });

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);

      const cu = await getAuthUser();
      if (!ignore) setCurrentUser(cu);

      if (!cu) {
        if (!ignore) {
          setLoading(false);
        }
        return;
      }

      let { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", slug)
        .maybeSingle();

      if (!prof) {
        const { data: byId } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", slug)
          .maybeSingle();
        prof = byId;
      }

      // Fallback: Check if author exists in posts
      if (!prof) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        let query = supabase.from("posts").select("user_id, user_email").limit(1);
        if (isUuid) {
          query = query.eq("user_id", slug);
        } else {
          query = query.ilike("user_email", `${slug}@%`);
        }

        const { data: postAuthor } = await query;
        if (postAuthor && postAuthor.length > 0) {
          const author = postAuthor[0];
          const fallbackUsername = author.user_email
            ? author.user_email.split("@")[0]
            : isUuid
            ? slug.slice(0, 8)
            : slug;
          prof = {
            id: author.user_id,
            username: fallbackUsername,
            display_name: fallbackUsername,
            bio: "",
            avatar_url: null,
            header_image_url: null,
          };
        }
      }

      if (!prof) {
        if (!ignore) {
          setProfile(null);
          setPosts([]);
          setLoading(false);
        }
        return;
      }

      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact" }).eq("following_id", prof.id),
        supabase.from("follows").select("*", { count: "exact" }).eq("follower_id", prof.id),
      ]);

      if (!ignore) {
        setFollowerCount(followers || 0);
        setFollowingCount(following || 0);
      }

      if (cu) {
        const { data: followRow } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", cu.id)
          .eq("following_id", prof.id)
          .maybeSingle();

        if (!ignore) setIsFollowing(!!followRow);
      }

      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", prof.id)
        .order("created_at", { ascending: false });

      const postIds = (postsData || []).map((p) => p.id);

      const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
        postIds.length
          ? supabase.from("likes").select("post_id, user_id").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from("comments").select("post_id").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
      ]);

      const likeCounts = {};
      const liked = [];
      (likeRows || []).forEach((row) => {
        likeCounts[row.post_id] = (likeCounts[row.post_id] || 0) + 1;
        if (cu && row.user_id === cu.id) liked.push(row.post_id);
      });

      const commentCounts = {};
      (commentRows || []).forEach((row) => {
        commentCounts[row.post_id] = (commentCounts[row.post_id] || 0) + 1;
      });

      if (!ignore) {
        setProfile(prof);
        setPosts(
          (postsData || []).map((p) => ({
            ...p,
            profile_username: prof.username || prof.id?.slice(0, 8),
          }))
        );
        setLikeCountMap(likeCounts);
        setCommentCountMap(commentCounts);
        setLikedPostIds(liked);
        setLoading(false);
      }
    }

    if (slug) load();
    return () => {
      ignore = true;
    };
  }, [slug]);

  const toggleFollow = async () => {
    if (!currentUser) {
      toast.info("Please sign in to follow photographers.");
      return;
    }

    if (currentUser.id === profile?.id) {
      toast.info("You cannot follow your own account.");
      return;
    }

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", profile.id);
      const newCount = Math.max(0, followerCount - 1);
      setIsFollowing(false);
      setFollowerCount(newCount);
      toast.info(`Unfollowed @${profile.username}`);
    } else {
      await supabase.from("follows").insert({
        follower_id: currentUser.id,
        following_id: profile.id,
      });
      const newCount = followerCount + 1;
      setIsFollowing(true);
      setFollowerCount(newCount);
      toast.success(`Now following @${profile.username}`);
    }
  };

  const onDeletePost = async (postId) => {
    const isOwner = currentUser && currentUser.id === profile?.id;
    setConfirmState({
      isOpen: true,
      title: isOwner ? "Delete Shot?" : "Admin: Delete Shot",
      description: "Permanently delete this shot from the database?",
      confirmWord: "",
      action: async () => {
        try {
          if (isAdmin(currentUser)) {
            const res = await executeAdminDelete("delete_post", { postId });
            if (!res.success) throw new Error(res.error || "Failed to delete post.");
          } else {
            await supabase.from("likes").delete().eq("post_id", postId);
            await supabase.from("comments").delete().eq("post_id", postId);
            const { error } = await supabase.from("posts").delete().eq("id", postId);
            if (error) throw error;
          }
          setPosts((prev) => prev.filter((p) => p.id !== postId));
          toast.success("Shot deleted.");
        } catch (error) {
          toast.error("Failed to delete shot: " + (error.message || error));
        }
      },
    });
  };

  const handleAdminDeleteUserPosts = () => {
    setConfirmState({
      isOpen: true,
      title: "Admin: Delete All User Posts",
      description: `Permanently delete all posts published by @${profile.username}?`,
      confirmWord: "DELETE",
      action: async () => {
        const res = await executeAdminDelete("delete_user_posts", { userId: profile.id });
        if (res.success) {
          toast.success(`All posts by @${profile.username} deleted.`);
          setPosts([]);
        } else {
          toast.error(res.error || "Failed to delete posts.");
        }
      },
    });
  };

  const handleAdminDeleteUser = () => {
    setConfirmState({
      isOpen: true,
      title: "Admin: Delete User From Existence",
      description: `Permanently delete @${profile.username} and all associated content.`,
      confirmWord: "DELETE",
      action: async () => {
        const res = await executeAdminDelete("delete_user", { userId: profile.id });
        if (res.success) {
          toast.success(`User @${profile.username} deleted from existence.`);
          router.push("/");
        } else {
          toast.error(res.error || "Failed to delete user.");
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
        <p className="font-serif text-xl text-ink font-normal">Loading profile...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthBarrier
        title="Creator Profile"
        subtitle={`Sign in to view @${slug || "photographer"}'s unfiltered moments, follow their camera roll, and connect.`}
        badge="MEMBERS ONLY • PROFILE"
      />
    );
  }

  if (!profile) {
    return (
      <div className="py-16 max-w-md mx-auto text-center">
        <div className="bg-surface border border-border rounded-3xl p-8 shadow-sm space-y-4">
          <h2 className="font-serif text-3xl text-ink font-normal">Profile not found</h2>
          <p className="text-sm text-ink-secondary">
            This photographer has not published any moments or may not exist on Shotzi yet.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Feed</span>
          </Link>
        </div>
      </div>
    );
  }

  const isOwn = currentUser && currentUser.id === profile.id;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </Link>
      </div>

      {/* ADMIN PROFILE MODERATION BAR */}
      {currentUser && isAdmin(currentUser) && !isOwn && (
        <div className="bg-danger-soft border border-danger/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-danger shrink-0" />
            <div>
              <span className="text-xs font-semibold text-danger block">
                Admin Moderation
              </span>
              <span className="text-[11px] text-ink-secondary">
                Managing @{profile.username} ({profile.id})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAdminDeleteUserPosts}
              className="px-3 py-1.5 rounded-full border border-danger text-danger bg-surface hover:bg-danger-soft text-xs font-medium transition-colors"
            >
              Delete All User Posts
            </button>
            <button
              type="button"
              onClick={handleAdminDeleteUser}
              className="px-3 py-1.5 rounded-full bg-danger text-white text-xs font-medium hover:bg-danger-hover transition-colors shadow-xs"
            >
              Delete User
            </button>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <ProfileHeader
        profile={profile}
        isOwn={isOwn}
        isFollowing={isFollowing}
        followerCount={followerCount}
        followingCount={followingCount}
        postsCount={posts.length}
        onFollow={toggleFollow}
        currentUser={currentUser}
        isAdminUser={currentUser && isAdmin(currentUser)}
        onEditClick={isOwn ? () => router.push("/profile") : undefined}
      />

      {/* Shots header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <h2 className="font-serif text-2xl font-normal text-ink">
          {isOwn ? "Your Shots" : `@${profile.username}’s Camera Roll`}
        </h2>
        <span className="font-mono text-xs text-ink-muted">
          {posts.length} {posts.length === 1 ? "moment" : "moments"}
        </span>
      </div>

      {/* Shots Grid */}
      <PostGrid
        posts={posts}
        currentUser={currentUser}
        likedPostIds={likedPostIds}
        likeCountMap={likeCountMap}
        commentCountMap={commentCountMap}
        onDeletePost={onDeletePost}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmWord={confirmState.confirmWord}
        danger={true}
        onConfirm={async () => {
          if (confirmState.action) await confirmState.action();
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
