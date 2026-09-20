import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getVerifiedUser } from "../../../../lib/serverAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req) {
  try {
    const verifiedUser = await getVerifiedUser(req);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pendingPostId, imageUrl, caption, notificationId } = body;
    const userId = verifiedUser.id;
    const userEmail = verifiedUser.email;

    if (!pendingPostId && !imageUrl) {
      return NextResponse.json(
        { error: "Missing required fields for resubmission." },
        { status: 400 }
      );
    }

    const db = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    let updated = false;

    // 1. If pendingPostId is provided, try updating that existing pending_post back to pending with current timestamp
    const now = new Date().toISOString();
    if (pendingPostId) {
      const { data, error } = await db
        .from("pending_posts")
        .update({
          status: "pending",
          caption: caption !== undefined ? caption : null,
          created_at: now,
        })
        .eq("id", pendingPostId)
        .eq("user_id", userId)
        .select()
        .single();

      if (!error && data) {
        updated = true;
      }
    }

    // 2. If not updated by ID (e.g. was deleted or new ID needed), insert a fresh pending post with the stored image
    if (!updated) {
      const { error: insertError } = await db.from("pending_posts").insert({
        image_url: imageUrl,
        caption: caption !== undefined ? caption : null,
        user_id: userId,
        user_email: userEmail || null,
        status: "pending",
        created_at: now,
      });

      if (insertError) {
        console.error("Resubmit insert error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // 3. Remove old rejection notification so it doesn't linger or confuse the user
    if (notificationId) {
      await db
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", userId);
    }

    // 4. Insert a new pending notification with current timestamp
    await db.from("notifications").insert({
      user_id: userId,
      message: caption
        ? `Your shot "${caption}" has been resubmitted and is pending approval.`
        : "Your shot has been resubmitted and is pending approval.",
      created_at: now,
      read: false,
    });

    return NextResponse.json({
      success: true,
      message: "Shot resubmitted for approval!",
    });
  } catch (err) {
    console.error("Resubmit route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
