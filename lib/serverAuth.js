import { createClient } from "@supabase/supabase-js";

/**
 * Verifies the Supabase authentication token from incoming Next.js API requests.
 * Extracts the Bearer token from the Authorization header, cookie, or search query.
 * Cryptographically validates with Supabase Auth.
 * Returns the verified User object, or null if unauthenticated or expired.
 */
export async function getVerifiedUser(request) {
  try {
    const authHeader = request.headers.get("authorization");
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      try {
        const url = new URL(request.url);
        token = url.searchParams.get("token");
      } catch (e) {}
    }

    // Check cookie fallback if present
    if (!token && typeof request.cookies?.get === "function") {
      token =
        request.cookies.get("sb-access-token")?.value ||
        request.cookies.get("supabase-auth-token")?.value;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || (!anonKey && !serviceKey)) {
      return null;
    }

    if (!token) {
      return null;
    }

    // Verify token with Supabase
    const authClient = createClient(supabaseUrl, serviceKey || anonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }

    return data.user;
  } catch (err) {
    console.error("[getVerifiedUser] Error validating auth token:", err);
    return null;
  }
}
