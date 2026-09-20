import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { getVerifiedUser } from "../../../../lib/serverAuth";
import { ADMIN_EMAIL } from "../../../../lib/admin";

const dataFilePath = path.join(process.cwd(), "data", "chat-rooms.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function checkIsAdmin(userId) {
  if (!userId || !supabase) return false;
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const email = data?.user?.email?.toLowerCase().trim();
    if (email === ADMIN_EMAIL) {
      return true;
    }
  } catch (e) {}

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, username")
      .eq("id", userId)
      .maybeSingle();
    const email = profile?.email?.toLowerCase().trim();
    if (email === ADMIN_EMAIL) {
      return true;
    }
  } catch (e) {}

  return false;
}

// Read rooms from local JSON fallback
function getLocalRooms() {
  try {
    if (!fs.existsSync(dataFilePath)) {
      const defaultRooms = [
        {
          id: "everyone",
          name: "Everyone's Corner",
          description: "Open chat for all",
          icon: "globe",
          image_url: "",
          is_private: false,
          creator_id: null,
          creator_username: "Shotzi",
          members: [],
          pending_requests: [],
          invite_code: "everyones-corner",
          created_at: new Date().toISOString(),
        },
      ];
      saveLocalRooms(defaultRooms);
      return defaultRooms;
    }
    const content = fs.readFileSync(dataFilePath, "utf8");
    return JSON.parse(content || "[]");
  } catch (error) {
    console.error("Error reading local chat rooms:", error);
    return [];
  }
}

// Save rooms to local JSON fallback
function saveLocalRooms(rooms) {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(rooms, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Error saving local chat rooms:", error);
    return false;
  }
}

// Unified getter: Try Supabase table first, merge with local JSON
async function fetchAllRooms() {
  const localRooms = getLocalRooms();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) {
        const map = new Map();
        localRooms.forEach((r) => map.set(r.id, r));
        data.forEach((r) => {
          const local = map.get(r.id) || {};
          const localMembers = Array.isArray(local.members) ? local.members : [];
          const dbMembers = Array.isArray(r.members) ? r.members : [];
          const mergedMembers = Array.from(new Set([...localMembers, ...dbMembers]));
          const localReqs = Array.isArray(local.pending_requests) ? local.pending_requests : [];
          const dbReqs = Array.isArray(r.pending_requests) ? r.pending_requests : [];
          const reqMap = new Map();
          localReqs.forEach((item) => reqMap.set(item.user_id, item));
          dbReqs.forEach((item) => reqMap.set(item.user_id, item));

          map.set(r.id, {
            ...local,
            ...r,
            members: mergedMembers,
            pending_requests: Array.from(reqMap.values()),
            pending_invites: Array.isArray(local.pending_invites) ? local.pending_invites : [],
          });
        });
        return Array.from(map.values());
      }
    } catch (e) {
      // Supabase table not available or network error
    }
  }
  return localRooms;
}

// Unified saver: Write to Supabase table if it exists, and always keep local JSON synchronized
async function persistRoom(room) {
  saveLocalRooms(
    (() => {
      const local = getLocalRooms();
      const idx = local.findIndex((r) => r.id === room.id);
      if (idx >= 0) {
        local[idx] = room;
      } else {
        local.push(room);
      }
      return local;
    })()
  );

  if (supabase) {
    try {
      const isUuid =
        typeof room.creator_id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          room.creator_id
        );
      const dbRoom = {
        id: room.id,
        name: room.name,
        description: room.description || "",
        icon: room.icon || "globe",
        image_url: room.image_url || "",
        is_private: Boolean(room.is_private),
        creator_id: isUuid ? room.creator_id : null,
        creator_username: room.creator_username || "Curator",
        members: Array.isArray(room.members) ? room.members : [],
        pending_requests: Array.isArray(room.pending_requests) ? room.pending_requests : [],
        invite_code: room.invite_code || "",
        created_at: room.created_at || new Date().toISOString(),
      };
      const { error } = await supabase.from("chat_rooms").upsert(dbRoom);
      if (error) {
        console.error("Error upserting room to Supabase:", error);
      }
    } catch (e) {
      // Table might not be created yet in Supabase
    }
  }
}

export async function GET(req) {
  try {
    const verifiedUser = await getVerifiedUser(req);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = verifiedUser.id;
    const roomId = searchParams.get("roomId");
    const inviteCode = searchParams.get("invite");

    let rooms = await fetchAllRooms();

    // Ensure Everyone's Corner is always present as the default room
    if (!rooms.some((r) => r.id === "everyone")) {
      const defaultRoom = {
        id: "everyone",
        name: "Everyone's Corner",
        description: "Open chat for all",
        icon: "globe",
        image_url: "",
        is_private: false,
        creator_id: null,
        creator_username: "Shotzi",
        members: [],
        pending_requests: [],
        invite_code: "everyones-corner",
        created_at: new Date().toISOString(),
      };
      rooms.unshift(defaultRoom);
      await persistRoom(defaultRoom);
    }

    // Query single room by ID or invite code
    if (roomId || inviteCode) {
      const target = rooms.find(
        (r) => (roomId && r.id === roomId) || (inviteCode && r.invite_code === inviteCode)
      );
      if (!target) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const isMember = !target.is_private || (userId && target.members?.includes(userId));
      const isCreator = userId && target.creator_id === userId;
      const hasPending = Boolean(
        userId && target.pending_requests?.some((p) => p.user_id === userId)
      );

      return NextResponse.json({
        room: {
          ...target,
          is_member: isMember,
          is_creator: isCreator,
          has_pending: hasPending,
        },
      });
    }

    // Decorate rooms with user permissions
    const decoratedRooms = rooms.map((r) => {
      const isMember = !r.is_private || (userId && r.members?.includes(userId));
      const isCreator = userId && r.creator_id === userId;
      const hasPending = Boolean(
        userId && r.pending_requests?.some((p) => p.user_id === userId)
      );

      return {
        ...r,
        is_member: isMember,
        is_creator: isCreator,
        has_pending: hasPending,
        pending_count: isCreator ? (r.pending_requests?.length || 0) : 0,
      };
    });

    return NextResponse.json({ rooms: decoratedRooms });
  } catch (error) {
    console.error("GET /api/chat/rooms error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const verifiedUser = await getVerifiedUser(req);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action } = body;
    let rooms = await fetchAllRooms();

    // 1. CREATE A ROOM
    if (action === "create") {
      const {
        name,
        description,
        icon = "globe",
        image_url = "",
        is_private = false,
        creator_id,
        creator_username,
      } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Room name is required." },
          { status: 400 }
        );
      }

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const uniqueId = `room_${slug}_${Date.now().toString(36)}`;
      const inviteCode = `${slug}-${Math.random().toString(36).slice(2, 7)}`;

      const newRoom = {
        id: uniqueId,
        name: name.trim(),
        description: description?.trim() || "A custom room on Shotzi.",
        icon,
        image_url: image_url?.trim() || "",
        is_private: Boolean(is_private),
        creator_id: creator_id || null,
        creator_username: creator_username || "Curator",
        members: creator_id ? [creator_id] : [],
        pending_requests: [],
        invite_code: inviteCode,
        created_at: new Date().toISOString(),
      };

      await persistRoom(newRoom);

      return NextResponse.json({
        success: true,
        room: {
          ...newRoom,
          is_member: true,
          is_creator: true,
          has_pending: false,
        },
      });
    }

    // 2. JOIN OR REQUEST TO JOIN A ROOM
    if (action === "join") {
      const { roomId, userId, username, display_name, avatar_url } = body;

      if (!roomId || !userId) {
        return NextResponse.json(
          { error: "roomId and userId are required." },
          { status: 400 }
        );
      }

      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex === -1) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const room = rooms[roomIndex];

      // If public room: auto join
      if (!room.is_private) {
        room.members = room.members || [];
        if (!room.members.includes(userId)) {
          room.members.push(userId);
          await persistRoom(room);
        }
        return NextResponse.json({
          success: true,
          status: "joined",
          message: "Joined room successfully.",
        });
      }

      // If private room: check if already member
      if (room.members?.includes(userId)) {
        return NextResponse.json({
          success: true,
          status: "joined",
          message: "Already a member.",
        });
      }

      // Check if already requested
      const alreadyRequested = room.pending_requests?.some(
        (p) => p.user_id === userId
      );

      if (!alreadyRequested) {
        room.pending_requests = room.pending_requests || [];
        room.pending_requests.push({
          user_id: userId,
          username: username || "User",
          display_name: display_name || username || "User",
          avatar_url: avatar_url || null,
          requested_at: new Date().toISOString(),
        });
        await persistRoom(room);
      }

      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request sent to the group creator.",
      });
    }

    // 3. CREATOR APPROVES OR REJECTS PENDING JOIN REQUEST
    if (action === "review_request") {
      const { roomId, creatorId, targetUserId, decision } = body;

      if (!roomId || !creatorId || !targetUserId || !decision) {
        return NextResponse.json(
          { error: "Missing required parameters." },
          { status: 400 }
        );
      }

      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex === -1) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const room = rooms[roomIndex];

      const isAuthorized = room.creator_id === creatorId || (await checkIsAdmin(creatorId));
      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Forbidden: Only the group creator or master admin can approve new members." },
          { status: 403 }
        );
      }

      room.pending_requests = room.pending_requests || [];
      // Remove from pending
      room.pending_requests = room.pending_requests.filter(
        (p) => p.user_id !== targetUserId
      );

      if (decision === "approve") {
        room.members = room.members || [];
        if (!room.members.includes(targetUserId)) {
          room.members.push(targetUserId);
        }
      }

      await persistRoom(room);

      return NextResponse.json({
        success: true,
        decision,
        pending_requests: room.pending_requests,
        members: room.members,
      });
    }

    // 4. ADD A MEMBER DIRECTLY (CREATOR OR MASTER ADMIN)
    if (action === "add_member") {
      const { roomId, creatorId, targetUserId } = body;

      if (!roomId || !creatorId || !targetUserId) {
        return NextResponse.json(
          { error: "Missing required parameters." },
          { status: 400 }
        );
      }

      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex === -1) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const room = rooms[roomIndex];
      const isAuthorized = room.creator_id === creatorId || (await checkIsAdmin(creatorId));
      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Forbidden: Only the room creator or master admin can add members." },
          { status: 403 }
        );
      }

      room.members = Array.isArray(room.members) ? room.members : [];
      if (!room.members.includes(targetUserId)) {
        room.members.push(targetUserId);
      }

      // Also remove from pending requests if present
      if (Array.isArray(room.pending_requests)) {
        room.pending_requests = room.pending_requests.filter(
          (p) => p.user_id !== targetUserId
        );
      }

      await persistRoom(room);

      return NextResponse.json({
        success: true,
        message: "Member added successfully.",
        members: room.members,
      });
    }

    // 5. REMOVE / KICK A MEMBER (CREATOR OR MASTER ADMIN)
    if (action === "remove_member") {
      const { roomId, creatorId, targetUserId } = body;

      if (!roomId || !creatorId || !targetUserId) {
        return NextResponse.json(
          { error: "Missing required parameters." },
          { status: 400 }
        );
      }

      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex === -1) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const room = rooms[roomIndex];
      const isAuthorized = room.creator_id === creatorId || (await checkIsAdmin(creatorId));
      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Forbidden: Only the room creator or master admin can remove members." },
          { status: 403 }
        );
      }

      room.members = (room.members || []).filter((id) => id !== targetUserId);
      await persistRoom(room);

      return NextResponse.json({
        success: true,
        message: "Member removed from room.",
        members: room.members,
      });
    }

    // 6. LEAVE A ROOM (REGULAR MEMBERS)
    if (action === "leave") {
      const { roomId, userId } = body;

      if (!roomId || !userId) {
        return NextResponse.json(
          { error: "roomId and userId are required." },
          { status: 400 }
        );
      }

      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex === -1) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const room = rooms[roomIndex];
      room.members = (room.members || []).filter((id) => id !== userId);
      if (Array.isArray(room.pending_requests)) {
        room.pending_requests = room.pending_requests.filter(
          (p) => p.user_id !== userId
        );
      }

      await persistRoom(room);

      return NextResponse.json({
        success: true,
        message: "Left room successfully.",
        members: room.members,
      });
    }

    // 7. DELETE / FINISH A ROOM COMPLETELY (CREATOR OR MASTER ADMIN)
    if (action === "delete_room") {
      const { roomId, creatorId } = body;
      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex === -1) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const room = rooms[roomIndex];
      const isAuthorized = room.creator_id === creatorId || (await checkIsAdmin(creatorId));
      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Forbidden: Only the creator or master admin can finish and delete this room." },
          { status: 403 }
        );
      }

      // 1. Remove from local JSON storage
      const local = getLocalRooms().filter((r) => r.id !== roomId);
      saveLocalRooms(local);

      // 2. Remove from Supabase chat_rooms table
      if (supabase) {
        try {
          await supabase.from("chat_rooms").delete().eq("id", roomId);
        } catch (e) {
          console.warn("Supabase room delete warning:", e);
        }

        // 3. Clean up messages for this room
        try {
          await supabase
            .from("global_messages")
            .delete()
            .ilike("message", `%${roomId}%`);
        } catch (e) {
          console.warn("Supabase room messages delete warning:", e);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Room finished and deleted completely.",
      });
    }

    // 8. INVITE A USER TO JOIN THE ROOM (CREATES NOTIFICATION WITH USER CHOICE)
    if (action === "invite_member") {
      const { roomId, creatorId, targetUserId } = body;

      if (!roomId || !creatorId || !targetUserId) {
        return NextResponse.json(
          { error: "Missing required parameters." },
          { status: 400 }
        );
      }

      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex === -1) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const room = rooms[roomIndex];
      const isAuthorized = room.creator_id === creatorId || (await checkIsAdmin(creatorId));
      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Forbidden: Only the room creator or master admin can invite members." },
          { status: 403 }
        );
      }

      // If user is already a member
      if (room.members?.includes(targetUserId)) {
        return NextResponse.json({
          success: true,
          status: "already_member",
          message: "User is already a member of this room.",
        });
      }

      // Track invite in room.pending_invites
      room.pending_invites = Array.isArray(room.pending_invites) ? room.pending_invites : [];
      if (!room.pending_invites.includes(targetUserId)) {
        room.pending_invites.push(targetUserId);
      }

      // Fetch creator details
      let creatorName = room.creator_username || "Curator";
      if (supabase) {
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("id", creatorId)
            .maybeSingle();
          if (prof) {
            creatorName = prof.display_name || prof.username || creatorName;
          }
        } catch (e) {}
      }

      // Create rich notification in Supabase notifications table
      if (supabase) {
        try {
          const notifPayload = {
            type: "room_invite",
            roomId: room.id,
            roomName: room.name,
            roomIcon: room.icon || "globe",
            roomDescription: room.description || "",
            creatorId,
            creatorUsername: creatorName,
            status: "pending",
            text: `${creatorName} invited you to join "${room.name}".`,
          };

          await supabase.from("notifications").insert({
            user_id: targetUserId,
            message: JSON.stringify(notifPayload),
            read: false,
          });
        } catch (err) {
          console.warn("Failed to create room invite notification:", err);
        }
      }

      await persistRoom(room);

      return NextResponse.json({
        success: true,
        message: `Invitation sent to user.`,
        pending_invites: room.pending_invites,
      });
    }

    // 9. RESPOND TO ROOM INVITATION (USER ACCEPTS OR DECLINES)
    if (action === "respond_invite") {
      const { roomId, userId, decision, notificationId } = body;

      if (!roomId || !userId || !decision) {
        return NextResponse.json(
          { error: "Missing required parameters." },
          { status: 400 }
        );
      }

      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex === -1) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }

      const room = rooms[roomIndex];
      room.pending_invites = (room.pending_invites || []).filter((id) => id !== userId);

      if (decision === "accept") {
        room.members = Array.isArray(room.members) ? room.members : [];
        if (!room.members.includes(userId)) {
          room.members.push(userId);
        }
      }

      await persistRoom(room);

      // Update notification record
      if (supabase && notificationId) {
        try {
          const { data: notif } = await supabase
            .from("notifications")
            .select("message")
            .eq("id", notificationId)
            .maybeSingle();

          if (notif?.message) {
            try {
              const parsed = JSON.parse(notif.message);
              parsed.status = decision === "accept" ? "accepted" : "declined";
              await supabase
                .from("notifications")
                .update({
                  message: JSON.stringify(parsed),
                  read: true,
                })
                .eq("id", notificationId);
            } catch (e) {
              await supabase
                .from("notifications")
                .update({ read: true })
                .eq("id", notificationId);
            }
          }
        } catch (e) {
          console.warn("Error updating invite notification:", e);
        }
      }

      return NextResponse.json({
        success: true,
        decision,
        roomName: room.name,
        members: room.members,
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/chat/rooms error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
