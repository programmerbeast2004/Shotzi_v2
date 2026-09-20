import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Shotzi] Supabase URL or anon key missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// In-memory user cache for instant hydration across client-side page transitions
let cachedUser = null;
let cachedTimestamp = 0;

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ?? null;
    cachedTimestamp = Date.now();
  });
}

/**
 * Returns the authenticated user instantly from in-memory cache or local session.
 * Eliminates redundant network waterfall delays on every tab and page navigation.
 */
export async function getAuthUser() {
  // 1. Instant return from recent in-memory cache
  if (cachedUser && Date.now() - cachedTimestamp < 30000) {
    return cachedUser;
  }

  // 2. Instant return from local storage session without network roundtrip
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      cachedUser = sessionData.session.user;
      cachedTimestamp = Date.now();
      return cachedUser;
    }
  } catch (e) {}

  // 3. Fallback to network getUser only if no local session exists
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      cachedUser = userData.user;
      cachedTimestamp = Date.now();
      return cachedUser;
    }
  } catch (e) {}

  cachedUser = null;
  return null;
}

