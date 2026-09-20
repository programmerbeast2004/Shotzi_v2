import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { NextResponse } from "next/server";
import path from "path";
import { ADMIN_EMAIL } from "../../../../lib/admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token." },
        { status: 401 }
      );
    }

    // Verify token with Supabase Auth
    const authClient = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired session." },
        { status: 401 }
      );
    }

    const requestingUser = userData.user;
    const reqEmail = (requestingUser.email || requestingUser.user_metadata?.email || "").toLowerCase().trim();
    const isMasterAdmin = reqEmail === ADMIN_EMAIL;

    if (!isMasterAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Master Admin privileges required." },
        { status: 403 }
      );
    }

    // Connect with service role key if available (which bypasses all RLS),
    // or forward the admin's JWT token
    const db = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: supabaseServiceKey
          ? { Authorization: `Bearer ${supabaseServiceKey}` }
          : { Authorization: `Bearer ${token}` },
      },
    });

    const body = await req.json();
    const { action, postId, userId } = body;

    // Helper to throw informative error if RLS blocked deletion
    const checkRlsNotice = (tableName) => {
      if (!supabaseServiceKey) {
        return ` Notice: If the row was not removed, Supabase RLS blocked it because SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Add your Supabase service_role secret key to .env.local for full bypass.`;
      }
      return "";
    };

    if (action === "delete_post") {
      if (!postId) {
        return NextResponse.json({ error: "Missing postId" }, { status: 400 });
      }

      // 1. Delete comments & comment likes on this post
      const { data: comments } = await db
        .from("comments")
        .select("id")
        .eq("post_id", postId);

      if (comments && comments.length > 0) {
        const commentIds = comments.map((c) => c.id);
        await db.from("comment_likes").delete().in("comment_id", commentIds);
        await db.from("comments").delete().eq("post_id", postId);
      }

      // 2. Delete post likes
      await db.from("likes").delete().eq("post_id", postId);

      // 3. Delete from posts
      const { data: delResult, error: postErr } = await db
        .from("posts")
        .delete()
        .eq("id", postId)
        .select();

      if (postErr) throw postErr;

      // 4. Delete from pending_posts
      await db.from("pending_posts").delete().eq("id", postId);

      const rlsBlocked = (!delResult || delResult.length === 0) && !supabaseServiceKey;
      if (rlsBlocked) {
        return NextResponse.json({
          success: false,
          error:
            "Supabase Row Level Security (RLS) blocked deleting this post. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local or add the admin SQL policy in Supabase.",
        }, { status: 403 });
      }

      return NextResponse.json({ success: true, message: `Post ${postId} deleted.` });
    }

    if (action === "delete_user_posts") {
      if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
      }

      // 1. Find all post IDs by this user
      const { data: userPosts } = await db
        .from("posts")
        .select("id")
        .eq("user_id", userId);

      let deletedCount = 0;
      if (userPosts && userPosts.length > 0) {
        const postIds = userPosts.map((p) => p.id);

        const { data: comments } = await db
          .from("comments")
          .select("id")
          .in("post_id", postIds);

        if (comments && comments.length > 0) {
          const commentIds = comments.map((c) => c.id);
          await db.from("comment_likes").delete().in("comment_id", commentIds);
          await db.from("comments").delete().in("post_id", postIds);
        }

        await db.from("likes").delete().in("post_id", postIds);
        const { data: delPosts } = await db.from("posts").delete().eq("user_id", userId).select();
        deletedCount = delPosts?.length || 0;
      }

      await db.from("pending_posts").delete().eq("user_id", userId);

      if (userPosts && userPosts.length > 0 && deletedCount === 0 && !supabaseServiceKey) {
        return NextResponse.json({
          success: false,
          error:
            "Supabase RLS blocked deleting posts by this user. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local to enable backend master deletion.",
        }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        message: `All posts by user ${userId} deleted.`,
      });
    }

    if (action === "delete_user") {
      if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
      }

      if (userId === requestingUser.id) {
        return NextResponse.json(
          { error: "Admin cannot delete their own account through this action." },
          { status: 400 }
        );
      }

      // 1. Delete all user posts and associated likes & comments
      const { data: userPosts } = await db
        .from("posts")
        .select("id")
        .eq("user_id", userId);

      if (userPosts && userPosts.length > 0) {
        const postIds = userPosts.map((p) => p.id);
        const { data: comments } = await db
          .from("comments")
          .select("id")
          .in("post_id", postIds);

        if (comments && comments.length > 0) {
          const commentIds = comments.map((c) => c.id);
          await db.from("comment_likes").delete().in("comment_id", commentIds);
          await db.from("comments").delete().in("post_id", postIds);
        }

        await db.from("likes").delete().in("post_id", postIds);
        await db.from("posts").delete().eq("user_id", userId);
      }
      await db.from("pending_posts").delete().eq("user_id", userId);

      // 2. Delete comments made by this user on any posts
      const { data: userComments } = await db
        .from("comments")
        .select("id")
        .eq("user_id", userId);

      if (userComments && userComments.length > 0) {
        const cIds = userComments.map((c) => c.id);
        await db.from("comment_likes").delete().in("comment_id", cIds);
        await db.from("comments").delete().eq("user_id", userId);
      }

      // 3. Delete likes & comment_likes made by this user
      await db.from("comment_likes").delete().eq("user_id", userId);
      await db.from("likes").delete().eq("user_id", userId);

      // 4. Delete follows
      await db.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);

      // 5. Delete direct messages
      await db.from("direct_messages").delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);

      // 6. Delete global messages
      await db.from("global_messages").delete().eq("user_id", userId);

      // 7. Delete notifications
      await db.from("notifications").delete().eq("user_id", userId);

      // 8. Delete profile row
      const { data: delProfile } = await db.from("profiles").delete().eq("id", userId).select();

      // 9. Delete user from Supabase Auth if service role key is present
      if (supabaseServiceKey) {
        try {
          await db.auth.admin.deleteUser(userId);
        } catch (e) {
          console.warn("auth.admin.deleteUser notice:", e?.message);
        }
      }

      return NextResponse.json({
        success: true,
        message: `User ${userId} and all related records deleted completely.`,
      });
    }

    // 4. MASTER ADMIN DELETE ROOM
    if (action === "delete_room") {
      const { roomId } = body;
      if (!roomId) {
        return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
      }

      if (roomId === "everyone") {
        return NextResponse.json(
          { error: "The default Everyone's Corner room cannot be deleted." },
          { status: 403 }
        );
      }

      if (!supabaseServiceKey) {
        return NextResponse.json(
          {
            error:
              "Room deletion requires SUPABASE_SERVICE_ROLE_KEY so the admin route can remove the room from Supabase as well as local storage.",
          },
          { status: 403 }
        );
      }

      // 1. Remove from Supabase chat_rooms and verify the row was actually deleted.
      const { data: deletedRooms, error: deleteError } = await db
        .from("chat_rooms")
        .delete()
        .eq("id", roomId)
        .select("id");

      if (deleteError) {
        throw deleteError;
      }

      if (!deletedRooms || deletedRooms.length === 0) {
        return NextResponse.json(
          {
            error:
              "Supabase did not delete the room row, so the room was not removed. Check the room id or Supabase permissions.",
          },
          { status: 403 }
        );
      }

      // 2. Remove from local JSON storage after the database delete succeeds.
      const dataFilePath = path.join(process.cwd(), "data", "chat-rooms.json");
      if (fs.existsSync(dataFilePath)) {
        try {
          const rooms = JSON.parse(fs.readFileSync(dataFilePath, "utf8") || "[]");
          const filtered = rooms.filter((r) => r.id !== roomId);
          fs.writeFileSync(dataFilePath, JSON.stringify(filtered, null, 2), "utf8");
        } catch (e) {
          console.warn("Local chat rooms delete warning:", e);
        }
      }

      // 3. Clean up all room messages
      await db.from("global_messages").delete().ilike("message", `%${roomId}%`);

      return NextResponse.json({
        success: true,
        message: `Room ${roomId} permanently removed by Master Administrator.`,
      });
    }

    return NextResponse.json({ error: "Invalid action requested." }, { status: 400 });
  } catch (err) {
    console.error("Admin delete route error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute admin delete operation." },
      { status: 500 }
    );
  }
}
