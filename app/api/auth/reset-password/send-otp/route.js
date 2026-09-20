import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOtp } from "../../../../../lib/otpStore";
import { sendPasswordResetOtpEmail } from "../../../../../lib/emailService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Find user in Supabase auth list
async function findUserByEmail(adminClient, targetEmail) {
  const normEmail = targetEmail.trim().toLowerCase();

  try {
    let page = 1;
    while (page <= 5) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 50,
      });
      if (error || !data?.users?.length) break;

      const found = data.users.find(
        (u) => u.email && u.email.toLowerCase() === normEmail
      );
      if (found) return found;

      if (data.users.length < 50) break;
      page++;
    }
  } catch (err) {
    console.warn("[Reset Password] Error searching listUsers:", err);
  }

  // Fallback: check profiles table if auth listUsers is restricted
  try {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", normEmail)
      .maybeSingle();

    if (profile) {
      return { id: profile.id, email: normEmail };
    }
  } catch (pErr) {
    // Non-fatal
  }

  return null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { email } = body || {};

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const normEmail = email.trim().toLowerCase();
    const adminClient = getAdminClient();

    // Verify account exists
    const user = await findUserByEmail(adminClient, normEmail);
    if (!user) {
      return NextResponse.json(
        { error: "No account found associated with this email address." },
        { status: 404 }
      );
    }

    // Generate randomized 6-digit OTP with 5-minute expiry
    const otpResult = createOtp(normEmail);

    if (otpResult.rateLimited) {
      return NextResponse.json(
        { error: otpResult.error, rateLimited: true },
        { status: 429 }
      );
    }

    const { otp, expiresIn, expiresAt } = otpResult;

    // Send email via SMTP
    await sendPasswordResetOtpEmail({
      to: normEmail,
      otp,
      expiresInMinutes: 5,
    });

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email!",
      expiresIn, // 300 seconds
      expiresAt,
    });
  } catch (err) {
    console.error("[Reset Password Send OTP Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send reset code. Please try again." },
      { status: 500 }
    );
  }
}
