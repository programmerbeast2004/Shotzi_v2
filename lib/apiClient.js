import { supabase } from "./supabaseClient";

/**
 * Authenticated fetch wrapper.
 * Automatically extracts the active Supabase session access token
 * and passes it as an `Authorization: Bearer <token>` header.
 */
export async function authFetch(url, options = {}) {
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch (e) {}

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
