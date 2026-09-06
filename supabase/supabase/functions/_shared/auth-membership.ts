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
  // The project_members.role for the caller, or null when the caller has
  // no membership row (super-admins land here too — owners write access
  // either way via the isSuperAdmin flag).
  role: MembershipRole | null;
};

// Returns whether the caller is a member of the place (or a
// super-admin). Runs the lookups in parallel.
//
// TWO PATHS, and they are not equal:
//
//   1. project_members — the direct Account <-> PLACE grant. Full range,
//      including `owner`.
//   2. organization_members joined through projects.organization_id — the
//      Account <-> ORGANIZATION <-> PLACE path added with the org
//      hierarchy (2026-09-05). **CAPPED AT EDITOR.**
//
// The cap is not a style choice. place-ownership.ts `isLastOwnerOfPlace`
// counts project_members rows with role='owner', so an org-derived owner
// counts 0 and would make ownership transfer and member removal misfire
// against `project_members_one_owner_per_project`; and
// business-web-get-overview attaches the Staff Check PIN on the owner
// branch, a column deliberately kept out of viewer payloads. Anything that
// genuinely needs the place's owner must use `requireProjectOwner` below,
// which reads project_members alone.
//
// The stronger of the two paths wins, after the cap is applied.
const ROLE_RANK: Record<MembershipRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/** The best role the ORG path may ever grant. See the cap note above. */
const ORG_PATH_CEILING: MembershipRole = "editor";

function strongerRole(
  a: MembershipRole | null,
  b: MembershipRole | null,
): MembershipRole | null {
  if (!a) return b;
  if (!b) return a;
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

export async function checkMembership(
  admin: SupabaseClient,
  user: AuthedUser,
  projectId: string,
): Promise<Membership> {
  const [isSuperAdmin, vm, org] = await Promise.all([
    checkSuperAdmin(admin, user),
    admin
      .from("project_members")
      .select("role")
      .eq("place_id", projectId)
      .eq("manager_id", user.id)
      .maybeSingle(),
    // One round trip, not two: read the place's organization and the
    // caller's membership of it in a single embedded select. This sits on
    // the hot path of every membership-gated EF.
    admin
      .from("projects")
      .select("organization_id, organizations!inner(organization_members!inner(role))")
      .eq("id", projectId)
      .eq("organizations.organization_members.manager_id", user.id)
      .maybeSingle(),
  ]);

  const directRole = (vm.data?.role as MembershipRole | undefined) ?? null;

  const orgRoleRaw = ((org.data as
    | { organizations?: { organization_members?: { role?: string }[] } }
    | null)?.organizations?.organization_members?.[0]?.role ?? null) as
    | MembershipRole
    | null;
  // Apply the ceiling: an org owner is an EDITOR of the org's places.
  const orgRole = orgRoleRaw
    ? (ROLE_RANK[orgRoleRaw] > ROLE_RANK[ORG_PATH_CEILING]
        ? ORG_PATH_CEILING
        : orgRoleRaw)
    : null;

  return {
    isSuperAdmin,
    role: strongerRole(directRole, orgRole),
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
// SAFE UNDER THE ORG PATH BY CONSTRUCTION: this tests `role !== "owner"`,
// and checkMembership caps the organization path at `editor`, so `owner`
// can only ever come from project_members (or the super-admin bypass).
// That is what keeps the one-owner-per-place invariant, ownership
// transfer, member removal and the Staff Check PIN intact without editing
// the seven EFs that call this.
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
