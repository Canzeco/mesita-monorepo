// The super-admin guard shared by the admin Edge Functions. Extracted from
// auth.ts so env/user/client helpers stay separate from "is this caller an
// operator?".
//
// Re-exported from auth.ts so callers import it from there.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import { json } from "./http.ts";

export async function checkSuperAdmin(
  admin: SupabaseClient,
  user: AuthedUser,
): Promise<boolean> {
  type SaRow = { email: string; phone: string | null; user_id: string | null };
  let saRow: SaRow | null = null;

  if (user.emailLower) {
    const { data } = await admin
      .from("super_admins")
      .select("email, phone, user_id")
      .eq("email", user.emailLower)
      .maybeSingle();
    saRow = (data as SaRow | null) ?? null;
  }
  if (!saRow && user.phone) {
    const { data } = await admin
      .from("super_admins")
      .select("email, phone, user_id")
      .eq("phone", user.phone)
      .maybeSingle();
    saRow = (data as SaRow | null) ?? null;
  }
  if (!saRow) return false;

  if (saRow.user_id == null) {
    // Fire-and-forget; the next call picks up the backfilled uuid. Target
    // the matched row by its email PK (always present) so the write is
    // unambiguous regardless of which identity matched.
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
// distinguish "I don't know who you are" from "I know but you can't".
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
