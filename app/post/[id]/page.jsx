"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Heart,
  MessageCircle,
  Trash2,
  ArrowLeft,
  Send,
  MoreHorizontal,
  Shield,
  CornerDownRight,
  User,
  X,
} from "lucide-react";
import { supabase, getAuthUser } from "../../../lib/supabaseClient";
import { isAdmin } from "../../../lib/admin";
import { executeAdminDelete } from "../../../lib/adminService";
import { useAuthDrawer } from "../../../components/AuthDrawer";
import { useToast } from "../../../components/Toast";
import ConfirmDialog from "../../../components/ConfirmDialog";
import AuthBarrier from "../../../components/AuthBarrier";

export default function PostDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { openAuth } = useAuthDrawer();
  const toast = useToast();

  const [post, setPost] = useState(null);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);

  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busyLike, setBusyLike] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [busyComment, setBusyComment] = useState(false);
  const [busyCommentLikes, setBusyCommentLikes] = useState({});

  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState(null);
  const textareaRef = useRef(null);

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

      try {
        const cu = await getAuthUser();
        if (ignore) return;
        setUser(cu);

        if (!cu) {
          setLoading(false);
          return;
        }

        // Step 1: Fetch post row, likes, and comments concurrently in parallel
        const [
          postRes,
          likesRes,
          commentsRes
        ] = await Promise.all([
          supabase.from("posts").select("*").eq("id", id).maybeSingle(),
          supabase.from("likes").select("user_id").eq("post_id", id),
          supabase.from("comments").select("id, post_id, user_id, user_email, content, created_at, parent_id").eq("post_id", id).order("created_at", { ascending: true }),
        ]);

        if (ignore) return;

        const postRow = postRes?.data;
        if (!postRow) {
          setPost(null);
          setLoading(false);
          return;
        }

        const likeRows = likesRes?.data || [];
        const commentRows = commentsRes?.data || [];
        const commentIds = commentRows.map((c) => c.id);
        const commenterIds = Array.from(new Set(commentRows.map((c) => c.user_id).filter(Boolean)));
        const allUserIds = Array.from(new Set([postRow.user_id, ...commenterIds]));

        // Optimistically set post, likes and loading so content renders immediately
        setPost(postRow);
        setLikes(likeRows.length);
        setLiked(cu ? likeRows.some((row) => row.user_id === cu.id) : false);

        // Step 2: Fetch author profile, commenter profiles, and comment likes in ONE parallel call
        const [profilesRes, commentLikesRes] = await Promise.all([
          supabase.from("profiles").select("id, username, display_name, avatar_url, bio").in("id", allUserIds),
          commentIds.length
            ? supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", commentIds)
            : Promise.resolve({ data: [] }),
        ]);

        if (ignore) return;

        const profilesList = profilesRes?.data || [];
        const commentLikeRows = commentLikesRes?.data || [];

        let prof = profilesList.find((p) => p.id === postRow.user_id);
        if (!prof) {
          const fallbackUsername = postRow.user_email?.split("@")[0] || postRow.user_id;
          prof = {
            id: postRow.user_id,
            username: fallbackUsername,
            display_name: fallbackUsername,
            bio: "",
          };
        }
        setProfile(prof);

        const commentLikeCount = {};
        const likedCommentsByUser = new Set();
        for (const row of commentLikeRows) {
          commentLikeCount[row.comment_id] = (commentLikeCount[row.comment_id] || 0) + 1;
          if (cu && row.user_id === cu.id) {
            likedCommentsByUser.add(row.comment_id);
          }
        }

        setComments(
          commentRows.map((c) => {
            const author = profilesList.find((p) => p.id === c.user_id);
            const profile_username =
              author?.username ||
              author?.display_name ||
              c.user_email?.split("@")[0] ||
              c.user_id.slice(0, 6);
            const authorUsername = author?.username || author?.id || c.user_id;
            return {
              ...c,
              profile_username,
              authorUsername,
              likeCount: commentLikeCount[c.id] || 0,
              likedByUser: likedCommentsByUser.has(c.id),
            };
          })
        );
      } catch (err) {
        console.error("Error loading post:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [id]);

  const handleLike = async () => {
    if (!user) {
      openAuth("signin");
      return;
    }
    if (busyLike || !post) return;
    setBusyLike(true);

    const willLike = !liked;
    setLiked(willLike);
    setLikes((c) => (willLike ? c + 1 : Math.max(0, c - 1)));

    try {
      if (willLike) {
        await supabase.from("likes").insert({
          user_id: user.id,
          post_id: post.id,
        });
      } else {
        await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", post.id);
      }
    } catch (err) {
      setLiked(!willLike);
      setLikes((c) => (!willLike ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setBusyLike(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    if (!user) {
      openAuth("signin");
      return;
    }
    if (busyCommentLikes[commentId]) return;

    setBusyCommentLikes((prev) => ({ ...prev, [commentId]: true }));
    const target = comments.find((c) => c.id === commentId);
    if (!target) {
      setBusyCommentLikes((prev) => ({ ...prev, [commentId]: false }));
      return;
    }

    const willLike = !target.likedByUser;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              likedByUser: willLike,
              likeCount: willLike ? c.likeCount + 1 : Math.max(0, c.likeCount - 1),
            }
          : c
      )
    );

    try {
      if (willLike) {
        await supabase.from("comment_likes").insert({
          comment_id: commentId,
          user_id: user.id,
        });
      } else {
        await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);
      }
    } catch (err) {
      // revert
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                likedByUser: !willLike,
                likeCount: !willLike ? c.likeCount + 1 : Math.max(0, c.likeCount - 1),
              }
            : c
        )
      );
    } finally {
      setBusyCommentLikes((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const handleDeleteComment = (commentId) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Comment?",
      description: "This comment will be permanently removed from this conversation.",
      confirmWord: "",
      action: async () => {
        try {
          await supabase.from("comments").delete().eq("id", commentId);
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          toast.success("Comment deleted.");
        } catch (error) {
          toast.error("Failed to delete comment.");
        }
      },
    });
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      openAuth("signin");
      return;
    }
    if (!commentText.trim() || busyComment) return;

    setBusyComment(true);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: post.id,
        user_id: user.id,
        user_email: user.email,
        content: commentText.trim(),
        parent_id: replyTo,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message || "Failed to post comment.");
      setBusyComment(false);
      return;
    }

    const formatted = {
      ...data,
      profile_username: data.user_email?.split("@")[0] || data.user_id.slice(0, 6),
      likeCount: 0,
      likedByUser: false,
    };

    try {
      const { data: authorProf } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", data.user_id)
        .maybeSingle();
      if (authorProf) {
        formatted.profile_username =
          authorProf.username || authorProf.display_name || formatted.profile_username;
        formatted.authorUsername = authorProf.username || authorProf.id;
      }
    } catch (e) {}

    setComments((prev) => [...prev, formatted]);
    setCommentText("");
    setReplyTo(null);
    setBusyComment(false);
    toast.success("Comment added.");

    setHighlightId(formatted.id);
    setTimeout(() => setHighlightId(null), 700);
  };

  const startReply = (commentId) => {
    const c = comments.find((com) => com.id === commentId);
    setReplyTo(commentId);
    if (c) {
      setCommentText(`@${c.profile_username} `);
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Post Deletion Actions
  const handleOwnerDeletePost = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete this shot?",
      description: "Are you sure you want to permanently remove this shot and its comments?",
      confirmWord: "",
      action: async () => {
        await supabase.from("likes").delete().eq("post_id", post.id);
        await supabase.from("comments").delete().eq("post_id", post.id);
        await supabase.from("posts").delete().eq("id", post.id);
        toast.success("Shot deleted.");
        router.push("/");
      },
    });
  };

  const handleAdminDeletePost = () => {
    setConfirmState({
      isOpen: true,
      title: "Admin: Delete Shot",
      description: "Permanently delete this shot from the community database?",
      confirmWord: "",
      action: async () => {
        const res = await executeAdminDelete("delete_post", { postId: post.id });
        if (res.success) {
          toast.success("Post removed by Admin.");
          router.push("/");
        } else {
          toast.error(res.error || "Failed to delete post.");
        }
      },
    });
  };

  const handleAdminDeleteUserPosts = () => {
    setConfirmState({
      isOpen: true,
      title: "Admin: Delete All User Posts",
      description: `Permanently delete all posts ever published by @${profileSlug}?`,
      confirmWord: "DELETE",
      action: async () => {
        const res = await executeAdminDelete("delete_user_posts", { userId: post.user_id });
        if (res.success) {
          toast.success(`All posts by @${profileSlug} deleted.`);
          router.push("/");
        } else {
          toast.error(res.error || "Failed to delete user posts.");
        }
      },
    });
  };

  const handleAdminDeleteUser = () => {
    setConfirmState({
      isOpen: true,
      title: "Admin: Delete User From Existence",
      description: `Permanently removes @${profileSlug} and all their posts, comments, likes, messages, and profile.`,
      confirmWord: "DELETE",
      action: async () => {
        const res = await executeAdminDelete("delete_user", { userId: post.user_id });
        if (res.success) {
          toast.success(`User @${profileSlug} deleted from existence.`);
          router.push("/");
        } else {
          toast.error(res.error || "Failed to delete user.");
        }
      },
    });
  };

  const buildThread = () => {
    const byParent = {};
    comments.forEach((c) => {
      const key = c.parent_id || "root";
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(c);
    });
    return byParent;
  };

  const threadsByParent = buildThread();

  const renderComments = (parentId = null, level = 0) => {
    const list = threadsByParent[parentId || "root"] || [];
    if (!list.length) return null;

    return (
      <ul className={`space-y-2.5 ${level > 0 ? "mt-2 pl-3 sm:pl-4 border-l-2 border-border" : ""}`}>
        {list.map((c) => {
          const createdAt = c.created_at
            ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true })
            : null;

          return (
            <li
              key={c.id}
              className={`p-3 rounded-2xl bg-surface-soft border border-border/70 text-xs transition-all ${
                highlightId === c.id ? "ring-2 ring-accent/30 bg-surface" : ""
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                    {c.profile_username?.charAt(0) || "U"}
                  </div>
                  <Link
                    href={`/u/${c.authorUsername || c.user_id}`}
                    className="font-medium text-ink hover:text-accent truncate"
                  >
                    @{c.profile_username}
                  </Link>
                  {createdAt && (
                    <span className="text-[10px] text-ink-muted shrink-0">· {createdAt}</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCommentLike(c.id)}
                    disabled={busyCommentLikes[c.id]}
                    aria-label="Like comment"
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      c.likedByUser
                        ? "border-danger/40 bg-danger-soft text-danger"
                        : "border-border text-ink-muted hover:text-ink hover:bg-surface"
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${c.likedByUser ? "fill-danger" : ""}`} />
                    <span className="font-mono">{c.likeCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startReply(c.id)}
                    className="text-[11px] text-ink-muted hover:text-accent font-medium px-1.5 py-0.5 rounded transition-colors"
                  >
                    Reply
                  </button>

                  {user && (user.id === c.user_id || user.id === post.user_id) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-[11px] text-danger hover:opacity-80 px-1 py-0.5"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Content - Strict overflow protection */}
              <p className="text-ink leading-relaxed whitespace-pre-line break-words overflow-wrap-anywhere min-w-0 max-w-full">
                {c.content}
              </p>

              {/* Nested replies */}
              {renderComments(c.id, level + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-[3px] border-black border-t-[#FFD21E] rounded-full animate-spin shadow-[2px_2px_0px_#000]" />
        <p className="font-black text-sm text-black uppercase tracking-wider">Loading shot...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthBarrier
        title="Community Shot"
        subtitle="Sign in to view this shot, leave heartfelt notes, and connect with the creator."
        badge="MEMBERS ONLY • SHOT"
      />
    );
  }

  if (!post) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="rounded-3xl border-2 border-black bg-white p-8 shadow-[6px_6px_0px_#18181B] space-y-4">
          <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-black mb-3">
            <img
              src="/illustrations/giraffe_scooter.jpg"
              alt="Giraffe on scooter"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-3xl font-black text-black">Oh noo!</h2>
          <p className="text-xs text-zinc-600 font-medium">
            This shot does not exist or may have scootered away with its creator.
          </p>
          <Link
            href="/"
            className="neo-btn neo-btn-yellow px-6 py-2.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </Link>
        </div>
      </div>
    );
  }

  const profileSlug = profile?.username || post.user_email?.split("@")[0] || post.user_id;
  const createdAt = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : null;
  const isOwner = user && user.id === post.user_id;
  const isUserAdmin = user && isAdmin(user);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="neo-btn neo-btn-white px-4 py-1.5 text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Feed</span>
        </Link>
      </div>

      {/* EDITORIAL SPLIT LAYOUT (65% Image / 35% Details & Comments) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: LARGE HERO IMAGE */}
        <section className="lg:col-span-7 xl:col-span-8 bg-white border-[2.5px] border-black rounded-3xl overflow-hidden shadow-[6px_6px_0px_#18181B] flex items-center justify-center p-3 sm:p-5">
          <img
            src={post.image_url}
            alt={post.caption || "Shotzi shot"}
            className="w-full h-auto max-h-[82vh] object-contain rounded-2xl border-2 border-black"
          />
        </section>

        {/* RIGHT COLUMN: CREATOR, CAPTION & CONVERSATION */}
        <section className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          {/* POST CARD HEADER */}
          <div className="bg-white border-[2.5px] border-black rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#18181B] space-y-4">
            {/* Creator info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link
                  href={`/u/${profileSlug}`}
                  className="w-10 h-10 rounded-2xl bg-[#FFD21E] text-black border-2 border-black flex items-center justify-center text-lg font-black shadow-[2px_2px_0px_#18181B] hover:scale-105 transition-transform"
                >
                  {profileSlug.charAt(0).toUpperCase()}
                </Link>
                <div>
                  <Link
                    href={`/u/${profileSlug}`}
                    className="font-black text-sm text-black hover:underline block"
                  >
                    @{profileSlug}
                  </Link>
                  {createdAt && <p className="text-[11px] text-zinc-500 font-bold">{createdAt}</p>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLike}
                  disabled={busyLike}
                  className={`neo-btn px-3.5 py-1.5 text-xs font-black transition-all ${
                    liked
                      ? "bg-[#FF5376] text-white shadow-[2px_2px_0px_#18181B]"
                      : "neo-btn-white"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${liked ? "fill-white text-white" : "text-black"}`} />
                  <span className="font-mono">{likes}</span>
                </button>

                {isOwner && !isUserAdmin && (
                  <button
                    type="button"
                    onClick={handleOwnerDeletePost}
                    className="p-1.5 rounded-full text-red-600 hover:bg-red-50 border-2 border-red-600 transition-colors"
                    title="Delete shot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Caption */}
            {post.caption && (
              <p className="text-sm text-zinc-900 font-bold leading-relaxed whitespace-pre-line break-words overflow-wrap-anywhere">
                {post.caption}
              </p>
            )}

            {/* ADMIN MODERATION BAR */}
            {isUserAdmin && (
              <div className="pt-3 border-t border-danger/20 bg-danger-soft/50 -mx-5 -mb-5 p-4 rounded-b-3xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Moderation</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAdminDeletePost}
                    className="px-2.5 py-1 rounded-lg bg-danger text-white text-xs font-medium hover:bg-danger-hover transition-colors shadow-xs"
                  >
                    Delete Post
                  </button>
                  {user.id !== post.user_id && (
                    <>
                      <button
                        type="button"
                        onClick={handleAdminDeleteUserPosts}
                        className="px-2.5 py-1 rounded-lg border border-danger text-danger bg-surface hover:bg-danger-soft text-xs font-medium transition-colors"
                      >
                        Delete All User Posts
                      </button>
                      <button
                        type="button"
                        onClick={handleAdminDeleteUser}
                        className="px-2.5 py-1 rounded-lg bg-danger-hover text-white text-xs font-medium hover:opacity-90 transition-colors"
                      >
                        Delete User
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* COMMENTS CONTAINER */}
          <div className="bg-white border-[2.5px] border-black rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#18181B] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
              <h3 className="text-xl font-black text-black flex items-center gap-2">
                Conversation
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#FFD21E] text-black border border-black shadow-[1px_1px_0px_#000]">
                  {comments.length}
                </span>
              </h3>
            </div>

            {/* Threaded comments list */}
            <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-3 soft-scroll">
              {comments.length === 0 ? (
                <div className="py-8 text-center text-zinc-500">
                  <p className="font-black text-base text-black mb-1">Quiet for now.</p>
                  <p className="text-xs font-medium">Be the first to leave something kind.</p>
                </div>
              ) : (
                renderComments()
              )}
            </div>

            {/* Reply banner if replying */}
            {replyTo && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFD21E] text-black border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#18181B]">
                <span className="flex items-center gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  Replying to @{comments.find((c) => c.id === replyTo)?.profile_username || "user"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setCommentText("");
                  }}
                  className="p-1 rounded hover:bg-black/10"
                >
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            )}

            {/* Comment Composer */}
            <form onSubmit={handleCommentSubmit} className="space-y-2 pt-2 border-t-2 border-black/10">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                disabled={!user || busyComment}
                placeholder={
                  user
                    ? replyTo
                      ? "Write a thoughtful reply..."
                      : "Leave a thought or note..."
                    : "Sign in to join the conversation."
                }
                className="w-full p-3 rounded-2xl border-2 border-black bg-zinc-50 text-black text-xs font-bold focus:bg-white focus:outline-none transition-all resize-none disabled:opacity-50 shadow-[2px_2px_0px_#18181B]"
              />
              <div className="flex items-center justify-between pt-1">
                {!user ? (
                  <button
                    type="button"
                    onClick={() => openAuth("signin")}
                    className="neo-btn neo-btn-yellow px-4 py-1.5 text-xs font-black"
                  >
                    Sign in to comment →
                  </button>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] text-zinc-500 font-bold">
                      {replyTo ? "Replying" : "Public moment"}
                    </span>
                    <button
                      type="submit"
                      disabled={busyComment || !commentText.trim()}
                      className="neo-btn neo-btn-yellow px-5 py-2 text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_#18181B]"
                    >
                      {busyComment ? "Posting..." : replyTo ? "Reply" : "Post Note"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* Confirmation Modal */}
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
