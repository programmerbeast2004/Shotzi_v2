"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PostGrid from "../../components/PostGrid";
import ProfileHeader from "../../components/ProfileHeader";
import ConfirmDialog from "../../components/ConfirmDialog";
import { supabase, getAuthUser } from "../../lib/supabaseClient";
import { useToast } from "../../components/Toast";
import { useAuthDrawer } from "../../components/AuthDrawer";
import { isAdmin } from "../../lib/admin";
import { Sparkles, Grid, Trash2, ArrowRight, Edit3, X } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    header_image_url: "",
    avatar_url: "",
  });

  const [likeCountMap, setLikeCountMap] = useState({});
  const [commentCountMap, setCommentCountMap] = useState({});
  const [likedPostIds, setLikedPostIds] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const { openAuth } = useAuthDrawer();

  useEffect(() => {
    let ignore = false;

    async function load(providedUser = null) {
      const safetyTimeout = setTimeout(() => {
        if (!ignore) setLoading(false);
      }, 5000);

      try {
        let u = providedUser;
        if (!u) {
          u = await getAuthUser();
        }

        if (!u) {
          if (!ignore) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (!ignore) {
          setUser(u);
        }

        // Fetch profile, posts, and follow counts in parallel
        const [
          profRes,
          postsRes,
          followsCounts,
        ] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
          supabase.from("posts").select("*").eq("user_id", u.id).order("created_at", { ascending: false }),
          Promise.all([
            supabase.from("follows").select("*", { count: "exact" }).eq("following_id", u.id),
            supabase.from("follows").select("*", { count: "exact" }).eq("follower_id", u.id),
          ]).catch(() => [{ count: 0 }, { count: 0 }]),
        ]);

        let prof = profRes?.data;
        const postsData = postsRes?.data || [];
        const followers = followsCounts?.[0]?.count || 0;
        const following = followsCounts?.[1]?.count || 0;

        if (!prof) {
          const username =
            u.user_metadata?.username ||
            u.email?.split("@")[0] ||
            `user_${u.id.slice(0, 6)}`;

          const displayName =
            u.user_metadata?.display_name ||
            u.user_metadata?.name ||
            username;

          try {
            const { data: inserted } = await supabase
              .from("profiles")
              .upsert(
                {
                  id: u.id,
                  username,
                  display_name: displayName,
                  last_active: new Date().toISOString(),
                },
                { onConflict: "id" }
              )
              .select("*")
              .maybeSingle();

            prof = inserted;
          } catch (insertErr) {
            console.warn("Could not insert profile:", insertErr);
          }
        }

        const fallbackProf = {
          id: u.id,
          username: prof?.username || u.user_metadata?.username || u.email?.split("@")[0] || `user_${u.id.slice(0, 6)}`,
          display_name: prof?.display_name || u.user_metadata?.name || u.email?.split("@")[0] || "Curator",
          bio: prof?.bio || "",
          header_image_url: prof?.header_image_url || "",
          avatar_url: prof?.avatar_url || "",
        };

        const postIds = (postsData || []).map((p) => p.id);

        let likeRows = [];
        let commentRows = [];
        if (postIds.length > 0) {
          try {
            const [lRes, cRes] = await Promise.all([
              supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
              supabase.from("comments").select("post_id").in("post_id", postIds),
            ]);
            likeRows = lRes?.data || [];
            commentRows = cRes?.data || [];
          } catch (e) {
            console.warn("Could not fetch likes/comments:", e);
          }
        }

        const likeCounts = {};
        const likedByUser = [];
        (likeRows || []).forEach((row) => {
          likeCounts[row.post_id] = (likeCounts[row.post_id] || 0) + 1;
          if (row.user_id === u.id) likedByUser.push(row.post_id);
        });

        const commentCounts = {};
        (commentRows || []).forEach((row) => {
          commentCounts[row.post_id] = (commentCounts[row.post_id] || 0) + 1;
        });

        if (!ignore) {
          setProfile(prof || fallbackProf);
          setForm({
            display_name: (prof || fallbackProf).display_name,
            username: (prof || fallbackProf).username,
            bio: (prof || fallbackProf).bio || "",
            header_image_url: (prof || fallbackProf).header_image_url || "",
            avatar_url: (prof || fallbackProf).avatar_url || "",
          });
          setPosts(
            (postsData || []).map((p) => ({
              ...p,
              profile_username: (prof || fallbackProf).username,
            }))
          );
          setLikeCountMap(likeCounts);
          setCommentCountMap(commentCounts);
          setLikedPostIds(likedByUser);
          setFollowerCount(followers || 0);
          setFollowingCount(following || 0);
        }
      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        clearTimeout(safetyTimeout);
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        load(session.user);
      } else {
        load();
      }
    });

    return () => {
      ignore = true;
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user || saving) return;

    const cleanUsername = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if (!cleanUsername || cleanUsername.length < 3) {
      toast.error("Username must be at least 3 characters (letters, numbers, underscores).");
      return;
    }

    setSaving(true);

    try {
      // If username changed, ensure it is unique across the platform
      if (cleanUsername !== profile?.username) {
        const { data: existingUser, error: checkError } = await supabase
          .from("profiles")
          .select("id, username")
          .eq("username", cleanUsername)
          .neq("id", user.id)
          .maybeSingle();

        if (checkError) {
          console.warn("Uniqueness check warning:", checkError);
        }

        if (existingUser) {
          toast.error(`@${cleanUsername} is already taken. Please pick another unique username.`);
          setSaving(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name.trim() || cleanUsername,
          username: cleanUsername,
          bio: form.bio.trim(),
          header_image_url: form.header_image_url.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      const oldUsername = profile?.username;
      setProfile(data);
      setForm((prev) => ({
        ...prev,
        username: data.username,
        display_name: data.display_name,
      }));
      setEditMode(false);

      if (oldUsername && oldUsername !== data.username) {
        toast.success(`Username updated to @${data.username}! @${oldUsername} is now released for others.`);
      } else {
        toast.success("Profile saved successfully.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // Clean up user data
      await supabase.from("posts").delete().eq("user_id", user.id);
      await supabase.from("comments").delete().eq("user_id", user.id);
      await supabase.from("likes").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);
      await supabase.auth.signOut();
      toast.success("Account deleted.");
      router.push("/");
    } catch (err) {
      toast.error("Failed to delete account: " + err.message);
    }
  };

  const onDeletePost = async (postId) => {
    if (!confirm("Are you sure you want to delete this shot?")) return;
    try {
      await supabase.from("likes").delete().eq("post_id", postId);
      await supabase.from("comments").delete().eq("post_id", postId);
      await supabase.from("posts").delete().eq("id", postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Shot deleted.");
    } catch (err) {
      toast.error("Failed to delete shot.");
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-[3px] border-black border-t-[#FFD21E] rounded-full animate-spin" />
        <p className="font-black text-sm text-black uppercase tracking-wider">Loading your corner...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-12 px-4 max-w-md mx-auto text-center">
        <div className="bg-white border-[3px] border-black rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_#18181B] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000] -rotate-3 text-2xl select-none">
            📸
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">Your Profile</h2>
          <p className="text-xs sm:text-sm text-zinc-600 font-bold leading-relaxed">
            Sign in to view your captured shots, edit your camera roll, and connect with other photographers.
          </p>
          <div className="pt-2">
            <Link
              href="/auth?mode=signin"
              className="neo-btn neo-btn-yellow px-6 py-2.5 text-xs font-black shadow-[3px_3px_0px_#18181B] inline-flex items-center gap-2 hover:-rotate-1 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              <span>Sign in to Shotzi</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <ProfileHeader
        profile={profile}
        isOwn={true}
        isAdminUser={isAdmin(user)}
        onEditClick={() => setEditMode(!editMode)}
        onDeleteClick={() => setDeleteDialogOpen(true)}
        followerCount={followerCount}
        followingCount={followingCount}
        postsCount={posts.length}
      />

      {/* Edit Profile Modal Dialog */}
      {editMode && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditMode(false)}
        >
          <div
            className="relative w-full max-w-lg bg-white border-[3px] border-black rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#000] space-y-5 my-auto max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFD21E] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] -rotate-3 shrink-0">
                  <Edit3 className="w-4 h-4 text-black stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-black">Edit Profile</h3>
                  <p className="text-[11px] font-bold text-zinc-500">Update your public details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center hover:bg-zinc-100 transition-colors cursor-pointer shadow-[1.5px_1.5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 shrink-0"
              >
                <X className="w-4 h-4 text-black stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wide">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border-2 border-black bg-zinc-50 text-black text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B]"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wide">
                    Username
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border-2 border-black bg-zinc-50 text-black text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B]"
                    placeholder="username"
                  />
                  <p className="text-[10px] text-zinc-500 font-semibold mt-1 leading-tight">
                    Must be unique. When changed, your previous handle is immediately freed for others.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wide">
                  Bio / Thoughts
                </label>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="w-full p-3.5 rounded-xl border-2 border-black bg-zinc-50 text-black text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B] resize-none"
                  placeholder="A few words about your camera roll and gaze..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wide">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={form.avatar_url}
                    onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full h-11 px-3.5 rounded-xl border-2 border-black bg-zinc-50 text-black text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wide">
                    Banner URL
                  </label>
                  <input
                    type="url"
                    value={form.header_image_url}
                    onChange={(e) => setForm({ ...form, header_image_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full h-11 px-3.5 rounded-xl border-2 border-black bg-zinc-50 text-black text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black/10">
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-zinc-100 text-xs font-black text-black cursor-pointer shadow-[1.5px_1.5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neo-btn neo-btn-yellow px-6 py-2.5 text-xs font-black shadow-[2.5px_2.5px_0px_#18181B] hover:-rotate-1 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shots Section Header */}
      <div className="flex items-center justify-between gap-3 border-b-[2.5px] border-black pb-4 pt-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#18181B] -rotate-2 shrink-0">
            <Grid className="w-5 h-5 text-black" />
          </div>
          <h2 className="text-xl sm:text-3xl font-black text-black tracking-tight truncate">
            Your Shots ({posts.length})
          </h2>
        </div>
        <Link
          href="/upload"
          className="neo-btn neo-btn-yellow px-4 sm:px-5 py-2 text-xs font-black shadow-[3px_3px_0px_#18181B] hover:-rotate-1 active:translate-x-0.5 active:translate-y-0.5 shrink-0 whitespace-nowrap"
        >
          <span>+ Dump a shot</span>
        </Link>
      </div>

      {/* Shots Grid */}
      <div className="space-y-4">
        <PostGrid
          posts={posts}
          currentUser={user}
          likedPostIds={likedPostIds}
          likeCountMap={likeCountMap}
          commentCountMap={commentCountMap}
          onDeletePost={onDeletePost}
        />
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Account Permanently?"
        description="This action cannot be undone. All your shots, comments, and profile data will be permanently wiped."
        confirmWord="DELETE"
        confirmLabel="Delete Account"
        danger={true}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
