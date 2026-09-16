// Place-membership + super-admin helpers shared by business/admin Edge
// Functions. Extracted from auth.ts so env/user/client helpers stay
// separate from "is this caller allowed to touch this place?".
//
// Re-exported from auth.ts so existing callers keep working unchanged.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import { json } from "./http.ts";

// Mirrors public.member_role. Team surface speaks owner/editor/viewer only
// (_shared/roles.ts). Waiter identity was retired (MESITA-833); the enum has no staff value.
type MembershipRole = "owner" | "editor" | "viewer";

type Membership = {
  isSuperAdmin: boolean;
  // The place_members.role for the caller, or null when the caller has
  // no membership row (super-admins land here too — owners write access
  // either way via the isSuperAdmin flag).
  role: MembershipRole | null;
};

// Returns whether the caller is a member of the place (or a super-admin).
//
// ONE PATH (MESITA-1892). `place_members` is the whole grant: the direct
// Account <-> PLACE row, full range, `owner` included.
//
// THERE USED TO BE A SECOND. Until the organization layer was removed, a
// caller could also reach a place through `organization_members` joined on
// `places.organization_id`, and that path was CAPPED AT EDITOR — because
// place-ownership.ts `isLastOwnerOfPlace` counts place_members rows with
// role='owner', so an org-derived owner counted 0 and would have made
// ownership transfer and member removal misfire against
// `place_members_one_owner_per_place`; and because business-web-get-overview
// attaches the Staff Check PIN on the owner branch.
//
// The removal migration turned every org grant into a real place_members row
// AT THAT SAME EDITOR CEILING, `on conflict do nothing` so a stronger direct
// grant still won. So nobody's access changed when the path disappeared —
// and `owner` still cannot arrive from anywhere but place_members, which is
// what keeps all three of those invariants true without a ceiling to apply.
//
// With one path there is nothing to rank, so the rank table and the
// stronger-of-two comparison went with the org branch. The role IS the row.

export async function checkMembership(
  admin: SupabaseClient,
  user: AuthedUser,
  placeId: string,
): Promise<Membership> {
  const [isSuperAdmin, vm] = await Promise.all([
    checkSuperAdmin(admin, user),
    admin
      .from("place_members")
      .select("role")
      .eq("place_id", placeId)
      .eq("manager_id", user.id)
      .maybeSingle(),
  ]);

  return {
    isSuperAdmin,
    role: (vm.data?.role as MembershipRole | undefined) ?? null,
  };
}

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
  placeId: string,
): Promise<
  | { ok: true; membership: Membership }
  | { ok: false; response: Response }
> {
  const m = await checkMembership(admin, user, placeId);
  if (!m.isSuperAdmin && m.role == null) {
    return {
      ok: false,
      response: json({ ok: false, error: "Not a member of this place" }, 403),
    };
  }
  return { ok: true, membership: m };
}

// 403s unless the caller is an owner (or super-admin).
// `owner` can only ever come from place_members (or the super-admin bypass),
// which is what keeps the one-owner-per-place invariant, ownership transfer,
// member removal and the Staff Check PIN intact.
export async function requireOwner(
  admin: SupabaseClient,
  user: AuthedUser,
  placeId: string,
  errorMessage = "Only owners can do that.",
): Promise<
  | { ok: true; membership: Membership }
  | { ok: false; response: Response }
> {
  const m = await checkMembership(admin, user, placeId);
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
  placeId: string,
  errorMessage = "Editors and owners only.",
): Promise<
  | { ok: true; membership: Membership }
  | { ok: false; response: Response }
> {
  const m = await checkMembership(admin, user, placeId);
  if (!m.isSuperAdmin && m.role !== "owner" && m.role !== "editor") {
    return {
      ok: false,
      response: json({ ok: false, error: errorMessage }, 403),
    };
  }
  return { ok: true, membership: m };
}
