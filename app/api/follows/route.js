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

// Curated aesthetic fallback covers matching Shotzi editorial vibe
const DEFAULT_COVERS = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80", // Ocean tide
  "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=800&q=80", // Sunlit wall & shadows
  "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80", // Sunset palm trees
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80", // Cosmic twilight
];

// GET /api/follows?userId=xxx&currentUserId=yyy
export async function GET(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || verifiedUser.id;
    const currentUserId = verifiedUser.id;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const db = getSupabaseClient();
    if (!db) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // 1. Fetch both following and followers relations
    const [followingRes, followersRes, currentUserFollowingRes] = await Promise.all([
      db.from("follows").select("following_id, created_at").eq("follower_id", userId),
      db.from("follows").select("follower_id, created_at").eq("following_id", userId),
      currentUserId
        ? db.from("follows").select("following_id").eq("follower_id", currentUserId)
        : Promise.resolve({ data: [] }),
    ]);

    // Exclude self-follows from both following and follower lists
    const followingIds = (followingRes.data || [])
      .map((r) => r.following_id)
      .filter((id) => id !== userId);
    const followerIds = (followersRes.data || [])
      .map((r) => r.follower_id)
      .filter((id) => id !== userId);
    const currentFollowingSet = new Set(
      (currentUserFollowingRes.data || [])
        .map((r) => r.following_id)
        .filter((id) => id !== currentUserId)
    );

    // Combine all unique target IDs to query profiles and metadata in batch
    const allUniqueIds = Array.from(new Set([...followingIds, ...followerIds]));

    let profiles = [];
    let posts = [];
    let allFollowers = [];
    let allFollowing = [];

    if (allUniqueIds.length > 0) {
      const [pRes, postsRes, f1Res, f2Res] = await Promise.all([
        db.from("profiles").select("*").in("id", allUniqueIds),
        db.from("posts").select("id, user_id, image_url, created_at").in("user_id", allUniqueIds),
        db.from("follows").select("following_id").in("following_id", allUniqueIds),
        db.from("follows").select("follower_id").in("follower_id", allUniqueIds),
      ]);
      profiles = pRes.data || [];
      posts = postsRes.data || [];
      allFollowers = f1Res.data || [];
      allFollowing = f2Res.data || [];
    }

    // Build enriched mapping
    const enrichUser = (profile, idx) => {
      if (!profile) return null;
      const userPosts = posts.filter((post) => post.user_id === profile.id);
      const userFollowers = allFollowers.filter((f) => f.following_id === profile.id);
      const userFollowing = allFollowing.filter((f) => f.follower_id === profile.id);

      const coverImage =
        profile.header_image_url ||
        userPosts[0]?.image_url ||
        DEFAULT_COVERS[idx % DEFAULT_COVERS.length];

      return {
        id: profile.id,
        username: profile.username || profile.id.slice(0, 8),
        display_name: profile.display_name || profile.username || "Creative",
        bio: profile.bio || "",
        avatar_url: profile.avatar_url || null,
        last_active: profile.last_active || profile.created_at,
        coverImage,
        shotsCount: userPosts.length,
        followersCount: userFollowers.length,
        followingCount: userFollowing.length,
        isFollowing: currentFollowingSet.has(profile.id),
      };
    };

    // Construct following list
    const followingList = followingIds
      .map((fid, i) => {
        const p = profiles.find((prof) => prof.id === fid);
        return enrichUser(p, i);
      })
      .filter(Boolean);

    // Construct followers list
    const followersList = followerIds
      .map((fid, i) => {
        const p = profiles.find((prof) => prof.id === fid);
        return enrichUser(p, i);
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      following: followingList,
      followers: followersList,
      counts: {
        following: followingList.length,
        followers: followersList.length,
      },
    });
  } catch (err) {
    console.error("GET /api/follows error:", err);
    return NextResponse.json({ error: err.message || "Failed to load follows" }, { status: 500 });
  }
}

// POST /api/follows: Toggle follow / unfollow
export async function POST(request) {
  try {
    const verifiedUser = await getVerifiedUser(request);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { followingId, action } = body;
    const followerId = verifiedUser.id; // Enforce caller identity!

    if (!followerId || !followingId) {
      return NextResponse.json({ error: "Missing followingId" }, { status: 400 });
    }

    if (followerId === followingId) {
      return NextResponse.json({ error: "You cannot follow your own account" }, { status: 400 });
    }

    const db = getSupabaseClient();
    if (!db) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    if (action === "unfollow") {
      const { error } = await db
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("following_id", followingId);

      if (error) throw error;
      return NextResponse.json({ success: true, action: "unfollowed" });
    }

    // Default: follow
    const { error } = await db.from("follows").insert({
      follower_id: followerId,
      following_id: followingId,
    });

    if (error && !error.message?.includes("duplicate")) {
      throw error;
    }

    // Insert follow notification for recipient
    try {
      const { data: followerProfile } = await db
        .from("profiles")
        .select("username, display_name")
        .eq("id", followerId)
        .maybeSingle();

      const name = followerProfile?.username || followerProfile?.display_name || "Someone";
      await db.from("notifications").insert({
        user_id: followingId,
        message: `@${name} started following you on Shotzi!`,
        read: false,
      });
    } catch (e) {
      // non-blocking
    }

    return NextResponse.json({ success: true, action: "followed" });
  } catch (err) {
    console.error("POST /api/follows error:", err);
    return NextResponse.json({ error: err.message || "Failed to update follow" }, { status: 500 });
  }
}
