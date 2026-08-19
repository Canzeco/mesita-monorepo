// Place-membership + super-admin helpers shared by business/admin Edge
// Functions. Extracted from auth.ts so env/user/client helpers stay
// separate from "is this caller allowed to touch this place?".
//
// Re-exported from auth.ts so existing callers keep working unchanged.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import { json } from "./http.ts";

// Mirrors public.member_role. Team surface speaks owner/editor/viewer only
// (_shared/roles.ts). 'staff' remains in this union so old rows still type-
// check; waiter identity was retired (MESITA-833) — 0 live staff rows expected.
type MembershipRole = "owner" | "editor" | "viewer" | "staff";

type Membership = {
  isSuperAdmin: boolean;
  // The project_members.role for the caller, or null when the caller has
  // no membership row (super-admins land here too — owners write access
  // either way via the isSuperAdmin flag).
  role: MembershipRole | null;
};

// Returns whether the caller is a member of the place (or a
// super-admin). Runs the two lookups in parallel.
export async function checkMembership(
  admin: SupabaseClient,
  user: AuthedUser,
  projectId: string,
): Promise<Membership> {
  const [isSuperAdmin, vm] = await Promise.all([
    checkSuperAdmin(admin, user),
    admin
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("manager_id", user.id)
      .maybeSingle(),
  ]);
  const role = (vm.data?.role as MembershipRole | undefined) ?? null;
  return {
    isSuperAdmin,
    role,
  };
}

// Resolves the super-admin allowlist row for the caller, lazy-backfilling
// user_id so future audit logs can join by uuid without re-reading
// auth.users. Returns `null` if the caller isn't on the list.
//
// Matches on EITHER identity the caller carries: email (Google OAuth
// operators) or phone (phone-OTP operators). A session may carry only one
// of the two — `super_admins` rows are keyed by email (PK) but may also
// pin a `phone`, so a phone-only operator is allowlisted by that column.
//
// Pattern moved out of 12+ admin EFs that each reimplemented the same
// lookup + lazy backfill. Callers that need a hard 403 should use
// `requireSuperAdmin` below; callers that want to render a soft "you're
// not on the list" state (auth-get-identity, business-web-get-overview) should
// call this directly and inspect the boolean.
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

// Convenience: 403s if the caller has no membership at all (and isn't
// a super-admin).
export async function requireMembership(
  admin: SupabaseClient,
  user: AuthedUser,
  projectId: string,
): Promise<
  | { ok: true; membership: Membership }
  | { ok: false; response: Response }
> {
  const m = await checkMembership(admin, user, projectId);
  if (!m.isSuperAdmin && m.role == null) {
    return {
      ok: false,
      response: json({ ok: false, error: "Not a member of this place" }, 403),
    };
  }
  return { ok: true, membership: m };
}

// 403s unless the caller is an owner (or super-admin).
export async function requireOwner(
  admin: SupabaseClient,
  user: AuthedUser,
  projectId: string,
  errorMessage = "Only owners can do that.",
): Promise<
  | { ok: true; membership: Membership }
  | { ok: false; response: Response }
> {
  const m = await checkMembership(admin, user, projectId);
  if (!m.isSuperAdmin && m.role !== "owner") {
    return {
      ok: false,
      response: json({ ok: false, error: errorMessage }, 403),
    };
  }
  return { ok: true, membership: m };
}

// 403s unless the caller is an editor or owner (or super-admin).
// Viewers are read-only on the Team surface — mutation EFs must use this
// (or requireOwner), never bare requireMembership.
export async function requireEditor(
  admin: SupabaseClient,
  user: AuthedUser,
  projectId: string,
  errorMessage = "Editors and owners only.",
): Promise<
  | { ok: true; membership: Membership }
  | { ok: false; response: Response }
> {
  const m = await checkMembership(admin, user, projectId);
  if (!m.isSuperAdmin && m.role !== "owner" && m.role !== "editor") {
    return {
      ok: false,
      response: json({ ok: false, error: errorMessage }, 403),
    };
  }
  return { ok: true, membership: m };
}
