import { supabase } from "./supabaseClient";

/**
 * Executes an admin delete action. Calls the server route /api/admin/delete with the user's session.
 * Falls back to direct client deletion if needed.
 *
 * @param {'delete_post'|'delete_user_posts'|'delete_user'} action
 * @param {object} params
 * @param {string} [params.postId]
 * @param {string} [params.userId]
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function executeAdminDelete(action, { postId, userId, roomId } = {}) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (token) {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, postId, userId, roomId }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        return { success: true, message: result.message };
      }
      if (!res.ok && result.error && res.status !== 500) {
        throw new Error(result.error);
      }
    }

    if (action === "delete_room" && roomId) {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "delete_room",
          roomId,
          creatorId: sessionData?.session?.user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete room.");
      return { success: true, message: "Room deleted completely." };
    }

    // Direct client fallback
    if (action === "delete_post" && postId) {
      await supabase.from("likes").delete().eq("post_id", postId);
      await supabase.from("comments").delete().eq("post_id", postId);
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
      await supabase.from("pending_posts").delete().eq("id", postId);
      return { success: true, message: "Post deleted directly." };
    }

    if (action === "delete_user_posts" && userId) {
      const { data: userPosts } = await supabase.from("posts").select("id").eq("user_id", userId);
      if (userPosts && userPosts.length > 0) {
        const postIds = userPosts.map((p) => p.id);
        await supabase.from("likes").delete().in("post_id", postIds);
        await supabase.from("comments").delete().in("post_id", postIds);
        const { error } = await supabase.from("posts").delete().eq("user_id", userId);
        if (error) throw error;
      }
      await supabase.from("pending_posts").delete().eq("user_id", userId);
      return { success: true, message: "User posts deleted directly." };
    }

    if (action === "delete_user" && userId) {
      const { data: userPosts } = await supabase.from("posts").select("id").eq("user_id", userId);
      if (userPosts && userPosts.length > 0) {
        const postIds = userPosts.map((p) => p.id);
        await supabase.from("likes").delete().in("post_id", postIds);
        await supabase.from("comments").delete().in("post_id", postIds);
        await supabase.from("posts").delete().eq("user_id", userId);
      }
      await supabase.from("pending_posts").delete().eq("user_id", userId);
      await supabase.from("comments").delete().eq("user_id", userId);
      await supabase.from("likes").delete().eq("user_id", userId);
      await supabase.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
      await supabase.from("direct_messages").delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
      await supabase.from("global_messages").delete().eq("user_id", userId);
      await supabase.from("notifications").delete().eq("user_id", userId);
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      return { success: true, message: "User and related records deleted." };
    }

    return { success: false, error: "Action could not be completed." };
  } catch (err) {
    console.error("executeAdminDelete error:", err);
    return { success: false, error: err.message || "Failed to execute delete." };
  }
}
