// The super-admin guard shared by the admin Edge Functions. Extracted from
// auth.ts so env/user/client helpers stay separate from "is this caller an
// operator?".
//
// Re-exported from auth.ts so callers import it from there.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import { json } from "./http.ts";

// The allowlist is keyed by email, its PK: admin-web-grant-admin writes an
// email and nothing else identifies an operator. A session without one (a
// phone-only consumer) can never be on it, so it costs no lookup.
export async function checkSuperAdmin(
  admin: SupabaseClient,
  user: AuthedUser,
): Promise<boolean> {
  if (!user.emailLower) return false;

  type SaRow = { email: string; user_id: string | null };
  const { data } = await admin
    .from("super_admins")
    .select("email, user_id")
    .eq("email", user.emailLower)
    .maybeSingle();
  const saRow = (data as SaRow | null) ?? null;
  if (!saRow) return false;

  if (saRow.user_id == null) {
    // Fire-and-forget; the next call picks up the backfilled uuid. Target
    // the matched row by its email PK.
    void admin
      .from("super_admins")
      .update({ user_id: user.id })
      .eq("email", saRow.email)
      .is("user_id", null);
  }
  return true;
}

// 403s unless the caller is in `public.super_admins`. The 401 for "no
// identity on session" stays explicit because every admin EF wants to
// distinguish "I don't know who you are" from "I know but you can't". A
// phone-only session is someone we know, so it gets the 403.
export async function requireSuperAdmin(
  admin: SupabaseClient,
  user: AuthedUser,
  errorMessage = "Not a super-admin",
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!user.emailLower && !user.phone) {
    return {
      ok: false,
      response: json({ ok: false, error: "No identity on session" }, 401),
    };
  }
  const ok = await checkSuperAdmin(admin, user);
  if (!ok) {
    return {
      ok: false,
      response: json({ ok: false, error: errorMessage }, 403),
    };
  }
  return { ok: true };
}
