import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVerifiedUser } from "../../../lib/serverAuth";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  if (supabaseUrl && anonKey) {
    return createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });
  }

  return null;
}

// GET /api/notifications?userId=xxx
export async function GET(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId || userId !== verifiedUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getSupabaseClient();
    if (!db) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // Fetch raw notifications, pending posts, and approved live posts in parallel
    const [
      { data: rawNotifs, error: notifErr },
      { data: pendingPosts, error: pendingErr },
      { data: rawPosts, error: postsErr },
    ] = await Promise.all([
      db.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      db.from("pending_posts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      db.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    if (notifErr) throw notifErr;
    if (pendingErr) throw pendingErr;
    if (postsErr) throw postsErr;

    const postIds = (rawPosts || []).map((p) => p.id);

    // 4. Fetch likes and comments for stats and card counters
    let postLikes = [];
    let postComments = [];
    if (postIds.length > 0) {
      const [likesRes, commentsRes] = await Promise.all([
        db.from("likes").select("id, post_id, user_id, created_at").in("post_id", postIds),
        db.from("comments").select("id, post_id, user_id, content, created_at").in("post_id", postIds),
      ]);
      postLikes = likesRes.data || [];
      postComments = commentsRes.data || [];
    }

    // Map like & comment counts to published posts
    const likeMap = {};
    postLikes.forEach((l) => {
      likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
    });

    const commentMap = {};
    postComments.forEach((c) => {
      commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1;
    });

    const publishedPosts = (rawPosts || []).map((p) => ({
      ...p,
      likeCount: likeMap[p.id] || 0,
      commentCount: commentMap[p.id] || 0,
    }));

    // 5. Intelligent 1-to-1 Correlation with pending_posts and posts
    // Track used pending_post IDs to avoid claiming the same shot multiple times
    const usedPendingIds = new Set();
    const activePendingPosts = (pendingPosts || []).filter((p) => p.status === "pending");
    const activePendingImages = new Set(activePendingPosts.map((p) => p.image_url));

    const enriched = [];

    // First, add all currently pending posts as top-priority "pending" notification items
    for (const p of activePendingPosts) {
      usedPendingIds.add(p.id);
      enriched.push({
        id: `pending-${p.id}`,
        user_id: p.user_id,
        type: "pending",
        status: "pending",
        title: "Shot Pending for Approval",
        subtitle: p.caption
          ? `Your photo "${p.caption}" has been submitted and is waiting for admin approval.`
          : "Your photo has been submitted and is waiting for admin approval.",
        thumbnail: p.image_url,
        caption: p.caption || "Untitled shot",
        postId: p.id,
        pendingPostId: p.id,
        created_at: p.created_at || new Date().toISOString(),
        read: false,
      });
    }

    for (const n of rawNotifs || []) {
      const msg = n.message || "";
      const lower = msg.toLowerCase();
      const notifTime = new Date(n.created_at).getTime();

      let type = "system";
      let title = "System Notification";
      let subtitle = msg;
      let thumbnail = null;
      let postId = null;
      let caption = null;
      let roomInviteData = null;

      // Check if message is a rich JSON payload (e.g. room invitation)
      if (msg.startsWith("{") && msg.endsWith("}")) {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.type === "room_invite") {
            type = "room_invite";
            title = `Group Invitation: ${parsed.roomName || "Room"}`;
            subtitle = `@${parsed.creatorUsername || "Curator"} invited you to join "${parsed.roomName}".`;
            roomInviteData = {
              roomId: parsed.roomId,
              roomName: parsed.roomName,
              roomIcon: parsed.roomIcon || "globe",
              roomDescription: parsed.roomDescription || "",
              creatorUsername: parsed.creatorUsername,
              creatorId: parsed.creatorId,
              inviteStatus: parsed.status || "pending",
            };
          }
        } catch (e) {}
      }

      if (type === "room_invite") {
        // Already parsed
      } else if (lower.includes("pending") || lower.includes("resubmitted")) {
        type = "pending";
        title = "Shot Pending for Approval";
        const matched = activePendingPosts.find((p) => !usedPendingIds.has(p.id)) || activePendingPosts[0];
        if (matched) {
          caption = matched.caption || "Untitled shot";
          thumbnail = matched.image_url;
          postId = matched.id;
          subtitle = `Your photo "${caption}" has been submitted and is waiting for admin approval.`;
        }
      } else if (lower.includes("approved") || lower.includes("published")) {
        type = "approval";
        title = "Your shot has been approved!";

        // Find the matching approved pending post (closest in time and unused)
        const candidatePending = (pendingPosts || []).filter(
          (p) => p.status === "approved" && !usedPendingIds.has(p.id)
        );

        // Sort candidates by proximity to notification timestamp
        candidatePending.sort(
          (a, b) =>
            Math.abs(new Date(a.created_at).getTime() - notifTime) -
            Math.abs(new Date(b.created_at).getTime() - notifTime)
        );

        const matchedPending = candidatePending[0];
        if (matchedPending) {
          usedPendingIds.add(matchedPending.id);
          caption = matchedPending.caption || "shot";
          thumbnail = matchedPending.image_url;
          subtitle = `Your photo "${caption}" is now live on your profile. ✨`;

          // Check if this shot is currently live in posts to get its post id
          const livePost = (rawPosts || []).find(
            (p) =>
              p.image_url === matchedPending.image_url ||
              (p.caption && p.caption.trim() === (matchedPending.caption || "").trim())
          );
          if (livePost) {
            postId = livePost.id;
          }
        } else {
          // Fallback to closest live post
          const livePost = (rawPosts || []).sort(
            (a, b) =>
              Math.abs(new Date(a.created_at).getTime() - notifTime) -
              Math.abs(new Date(b.created_at).getTime() - notifTime)
          )[0];

          if (livePost) {
            caption = livePost.caption || "shot";
            thumbnail = livePost.image_url;
            postId = livePost.id;
            subtitle = `Your photo "${caption}" is now live on your profile. ✨`;
          } else {
            subtitle = "Your photo is now live on your profile. ✨";
          }
        }
      } else if (lower.includes("reject") || lower.includes("guidelines") || lower.includes("declined")) {
        type = "rejection";
        title = "Your shot wasn't approved";

        // Find the matching rejected pending post (closest in time and unused, and not currently resubmitted/pending)
        const candidateRejected = (pendingPosts || []).filter(
          (p) => p.status === "rejected" && !usedPendingIds.has(p.id) && !activePendingImages.has(p.image_url)
        );

        candidateRejected.sort(
          (a, b) =>
            Math.abs(new Date(a.created_at).getTime() - notifTime) -
            Math.abs(new Date(b.created_at).getTime() - notifTime)
        );

        const matchedRejected = candidateRejected[0];
        // If this image was already resubmitted and is currently pending, skip showing the old rejection
        if (!matchedRejected && activePendingImages.size > 0) {
          continue;
        }

        if (matchedRejected) {
          usedPendingIds.add(matchedRejected.id);
          caption = matchedRejected.caption || "Untitled shot";
          thumbnail = matchedRejected.image_url;
          postId = matchedRejected.id;
          subtitle = `Your photo "${caption}" was not approved due to community guidelines. You can make changes and resubmit.`;
        } else {
          subtitle = "Your photo was not approved due to community guidelines. You can make changes and resubmit.";
        }
      } else if (lower.includes("comment")) {
        type = "comment";
        title = "New comment on your shot";
        subtitle = msg;
        const matched = (rawPosts || []).find(
          (p) => p.caption && lower.includes(p.caption.toLowerCase())
        ) || rawPosts?.[0];
        if (matched) {
          thumbnail = matched.image_url;
          postId = matched.id;
        }
      } else if (lower.includes("like")) {
        type = "like";
        title = "Your shot got a like!";
        subtitle = msg;
        const matched = (rawPosts || []).find(
          (p) => p.caption && lower.includes(p.caption.toLowerCase())
        ) || rawPosts?.[0];
        if (matched) {
          thumbnail = matched.image_url;
          postId = matched.id;
        }
      } else {
        type = "system";
        title = "Welcome to Shotzi!";
        subtitle = msg.includes("Welcome")
          ? "Start by dumping your first shot and join the community."
          : msg;
      }

      enriched.push({
        ...n,
        type,
        title,
        subtitle,
        thumbnail,
        postId,
        caption,
        ...(roomInviteData || {}),
      });
    }

    // Sort all notifications chronologically: newest timestamp first!
    enriched.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // 6. Deduplication: Filter out rapid-fire duplicate notifications for the exact same event
    const seenEvents = new Set();
    const notifications = enriched.filter((item) => {
      const eventKey = `${item.type}-${item.caption || item.roomId || "general"}-${Math.floor(
        new Date(item.created_at).getTime() / 60000
      )}`;
      if (seenEvents.has(eventKey)) {
        return false;
      }
      seenEvents.add(eventKey);
      return true;
    });

    // 7. Counts & Stats
    const pendingCount = activePendingPosts.length;
    const approvalsCount = notifications.filter((n) => n.type === "approval").length;
    const rejectionsCount = notifications.filter((n) => n.type === "rejection").length;
    const commentsCount = notifications.filter((n) => n.type === "comment").length;
    const likesCount = notifications.filter((n) => n.type === "like").length;
    const invitesCount = notifications.filter((n) => n.type === "room_invite").length;
    const systemCount = notifications.filter((n) => n.type === "system").length;
    const unreadCount = notifications.filter((n) => !n.read).length;

    const quickStats = {
      publishedShots: publishedPosts.length,
      pendingShots: pendingCount,
      rejectedShots: rejectionsCount,
      newComments: postComments.length,
      totalLikes: postLikes.length,
    };

    const filterCounts = {
      all: notifications.length,
      pending: pendingCount,
      approvals: approvalsCount,
      rejections: rejectionsCount,
      comments: commentsCount,
      likes: likesCount,
      invites: invitesCount,
      system: systemCount,
    };

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      filterCounts,
      quickStats,
      pendingPosts: pendingPosts || [],
      publishedPosts,
    });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load notifications" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications: Mark single or all read
export async function PATCH(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, all, userId } = body;

    const db = getSupabaseClient();
    if (!db) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    if (all) {
      const { error } = await db
        .from("notifications")
        .update({ read: true })
        .eq("user_id", verifiedUser.id)
        .eq("read", false);

      if (error) throw error;
      return NextResponse.json({ success: true, message: "All marked as read" });
    }

    if (id) {
      const { error } = await db
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", verifiedUser.id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/notifications error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update notification" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications
export async function DELETE(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearRead = searchParams.get("clearRead") === "true";

    const db = getSupabaseClient();
    if (!db) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    if (clearRead) {
      const { error } = await db
        .from("notifications")
        .delete()
        .eq("user_id", verifiedUser.id)
        .eq("read", true);

      if (error) throw error;
      return NextResponse.json({ success: true, message: "All read notifications cleared" });
    }

    if (id) {
      const { error } = await db
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", verifiedUser.id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Notification deleted" });
    }

    return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
  } catch (err) {
    console.error("DELETE /api/notifications error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete notification" },
      { status: 500 }
    );
  }
}

// POST /api/notifications
export async function POST(request) {
  try {
    const body = await request.json();
    const { user_id, message } = body;

    if (!user_id || !message) {
      return NextResponse.json({ error: "Missing user_id or message" }, { status: 400 });
    }

    const db = getSupabaseClient();
    if (!db) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error } = await db
      .from("notifications")
      .insert({
        user_id,
        message: message.trim(),
        read: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, notification: data });
  } catch (err) {
    console.error("POST /api/notifications error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create notification" },
      { status: 500 }
    );
  }
}
