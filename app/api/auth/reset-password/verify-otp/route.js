import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyOtp } from "../../../../../lib/otpStore";

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
    console.warn("[Reset Password Verify] Error searching listUsers:", err);
  }

  return null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, otp, newPassword } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    if (!otp || String(otp).trim().length === 0) {
      return NextResponse.json(
        { error: "Please enter the 6-digit OTP verification code." },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const normEmail = email.trim().toLowerCase();

    // Verify OTP against store
    const otpResult = verifyOtp(normEmail, otp);
    if (!otpResult.success) {
      return NextResponse.json(
        {
          error: otpResult.error,
          code: otpResult.code,
          remainingAttempts: otpResult.remainingAttempts,
        },
        { status: 400 }
      );
    }

    // Find the user to update
    const adminClient = getAdminClient();
    const user = await findUserByEmail(adminClient, normEmail);

    if (!user) {
      return NextResponse.json(
        { error: "User account could not be found to update password." },
        { status: 404 }
      );
    }

    // Update the password and confirm email in Supabase Auth (since possession was proven via OTP)
    const { data: updateData, error: updateError } =
      await adminClient.auth.admin.updateUserById(user.id, {
        password: newPassword,
        email_confirm: true,
      });

    if (updateError) {
      console.error("[Reset Password Update Error]:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update password." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your password has been successfully updated! You can now sign in.",
    });
  } catch (err) {
    console.error("[Reset Password Verify Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify code and update password." },
      { status: 500 }
    );
  }
}
