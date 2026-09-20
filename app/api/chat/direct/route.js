import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVerifiedUser } from "../../../../lib/serverAuth";

// Helper to get administrative or service-role Supabase client
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function normalizeCreatedAt(raw) {
  if (!raw) return new Date().toISOString();
  if (typeof raw === "string" && !raw.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(raw)) {
    return raw.includes(" ") ? raw.replace(" ", "T") + "Z" : raw + "Z";
  }
  return raw;
}

export async function GET(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to access conversations." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");
    const partnerId = searchParams.get("partnerId");
    const curatorsOnly = searchParams.get("curators") === "true";

    // Enforce that user can only request their own conversations
    const userId = verifiedUser.id;
    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json(
        { error: "Forbidden. You cannot access another user's private messages." },
        { status: 403 }
      );
    }

    const db = getAdminClient();
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // 0. If curators requested, return all users in database (excluding current user)
    if (curatorsOnly) {
      const { data: allCurators, error: curError } = await db
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, role, last_active")
        .neq("id", userId)
        .order("display_name", { ascending: true });

      if (curError) throw curError;

      return NextResponse.json({
        success: true,
        curators: allCurators || [],
      });
    }

    // 1. If partnerId is provided, return full conversation thread + partner profile & media
    if (partnerId) {
      const [messagesRes, partnerRes, postsRes, totalPostsRes, followersRes, followingRes] = await Promise.all([
        db
          .from("direct_messages")
          .select("*")
          .or(
            `and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`
          )
          .order("created_at", { ascending: true }),
        db.from("profiles").select("*").eq("id", partnerId).maybeSingle(),
        db
          .from("posts")
          .select("id, image_url, caption, created_at")
          .eq("user_id", partnerId)
          .order("created_at", { ascending: false })
          .limit(9),
        db.from("posts").select("id", { count: "exact", head: true }).eq("user_id", partnerId),
        db.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", partnerId),
        db.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", partnerId),
      ]);

      const partnerProfile = partnerRes.data || {
        id: partnerId,
        username: partnerId.slice(0, 8),
        display_name: "Creative",
      };

      const sharedMedia = (postsRes.data || []).map((p) => ({
        id: p.id,
        url: p.image_url,
        caption: p.caption || "Shot",
      }));

      const rawMessages = messagesRes.data || [];
      const normalizedMessages = rawMessages.map((m) => {
        const isUnsent = Boolean(
          m.message?.startsWith("::shotzi_unsent::") || m.message === "::shotzi_unsent::"
        );
        return {
          ...m,
          is_unsent: isUnsent,
          message: isUnsent ? "" : m.message,
          created_at: normalizeCreatedAt(m.created_at),
        };
      });

      return NextResponse.json({
        success: true,
        messages: normalizedMessages,
        partner: {
          ...partnerProfile,
          shotsCount: totalPostsRes.count ?? 0,
          followersCount: followersRes.count ?? 0,
          followingCount: followingRes.count ?? 0,
          sharedMedia,
        },
      });
    }

    // 2. If no partnerId, return list of all active conversations for userId
    const { data: allUserMessages, error: msgsError } = await db
      .from("direct_messages")
      .select("id, sender_id, recipient_id, message, created_at, read")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (msgsError) throw msgsError;

    // Group by conversation partner
    const partnerMap = new Map();
    for (const msg of allUserMessages || []) {
      const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      if (!partnerId) continue;
      if (!partnerMap.has(partnerId)) {
        const isUnsent = Boolean(
          msg.message?.startsWith("::shotzi_unsent::") || msg.message === "::shotzi_unsent::"
        );
        partnerMap.set(partnerId, {
          lastMessage: isUnsent ? "This message was unsent" : msg.message,
          isLastMessageUnsent: isUnsent,
          lastMessageTime: normalizeCreatedAt(msg.created_at),
          unreadCount: 0,
        });
      }
      if (msg.recipient_id === userId && !msg.read) {
        const entry = partnerMap.get(partnerId);
        entry.unreadCount += 1;
      }
    }

    const partnerIds = Array.from(partnerMap.keys());
    let profiles = [];
    if (partnerIds.length > 0) {
      const { data: profData } = await db
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, last_active")
        .in("id", partnerIds);
      profiles = profData || [];
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const conversations = partnerIds.map((pid) => {
      const prof = profileMap.get(pid) || {
        id: pid,
        username: pid.slice(0, 8),
        display_name: "Creative",
      };
      const meta = partnerMap.get(pid);
      return {
        id: pid,
        profile: prof,
        lastMessage: meta.lastMessage,
        lastMessageTime: meta.lastMessageTime,
        unreadCount: meta.unreadCount,
      };
    });

    // Sort by latest message time
    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (err) {
    console.error("GET /api/chat/direct error:", err);
    return NextResponse.json({ error: err.message || "Failed to load chat" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to send messages." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { recipient_id, message } = body;
    // Always enforce the sender is the verified user! Cannot impersonate another user!
    const sender_id = verifiedUser.id;

    if (!recipient_id || !message?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getAdminClient();
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await db
      .from("direct_messages")
      .insert({
        sender_id,
        recipient_id,
        message: message.trim(),
        read: false,
        created_at: nowIso,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: {
        ...data,
        created_at: normalizeCreatedAt(data?.created_at || nowIso),
      },
    });
  } catch (err) {
    console.error("POST /api/chat/direct error:", err);
    return NextResponse.json({ error: err.message || "Failed to send message" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { partnerId } = body;
    const userId = verifiedUser.id;

    if (!partnerId) {
      return NextResponse.json({ error: "Missing partnerId" }, { status: 400 });
    }

    const db = getAdminClient();
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { error } = await db
      .from("direct_messages")
      .update({ read: true })
      .eq("sender_id", partnerId)
      .eq("recipient_id", userId)
      .eq("read", false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/chat/direct error:", err);
    return NextResponse.json({ error: err.message || "Failed to mark read" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to unsend messages." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let messageId = searchParams.get("messageId");
    if (!messageId) {
      try {
        const body = await request.json();
        messageId = body?.messageId;
      } catch {}
    }

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const db = getAdminClient();
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // 1. Fetch message to verify ownership
    const { data: existingMsg, error: fetchErr } = await db
      .from("direct_messages")
      .select("*")
      .eq("id", messageId)
      .maybeSingle();

    if (fetchErr || !existingMsg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Security check: Only the sender can unsend their own message!
    if (existingMsg.sender_id !== verifiedUser.id) {
      return NextResponse.json(
        { error: "Forbidden. You can only unsend messages you sent." },
        { status: 403 }
      );
    }

    // 2. Mark as unsent with safety marker and wipe the original content
    const nowIso = new Date().toISOString();
    const unsentMarker = `::shotzi_unsent::${nowIso}`;

    const { data: updatedMsg, error: updateErr } = await db
      .from("direct_messages")
      .update({
        message: unsentMarker,
      })
      .eq("id", messageId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      messageId,
      message: {
        ...updatedMsg,
        is_unsent: true,
        message: "",
        created_at: normalizeCreatedAt(updatedMsg.created_at),
      },
    });
  } catch (err) {
    console.error("DELETE /api/chat/direct error:", err);
    return NextResponse.json({ error: err.message || "Failed to unsend message" }, { status: 500 });
  }
}

