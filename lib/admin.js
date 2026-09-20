// Central Admin Configuration
// Set NEXT_PUBLIC_ADMIN_EMAIL in your .env.local to configure the master admin.

export const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || "prvmehrotra@gmail.com"
).toLowerCase().trim();

/**
 * Checks whether a given user object represents the administrator.
 * @param {object|null} user - The Supabase user object.
 * @returns {boolean}
 */
export function isAdmin(user) {
  if (!user) return false;
  const email = (
    user.email ||
    user.user_metadata?.email ||
    ""
  )
    .toLowerCase()
    .trim();

  if (!email) return false;
  return email === ADMIN_EMAIL;
}
