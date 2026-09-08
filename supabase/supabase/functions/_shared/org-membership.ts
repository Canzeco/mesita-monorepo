// Account <-> Organization helpers. Distinct from auth-membership.ts, which
// answers "may this caller touch this PLACE"; this answers "is this caller
// in this ORGANIZATION, and how strongly".

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import { json } from "./http.ts";

export type OrgRole = "owner" | "editor" | "viewer";

export async function orgRoleFor(
  admin: SupabaseClient,
  user: AuthedUser,
  organizationId: string,
): Promise<OrgRole | null> {
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("manager_id", user.id)
    .maybeSingle();
  return ((data as { role?: OrgRole } | null)?.role ?? null);
}

/** The organization that holds a place, for EFs a place console calls with a
 *  placeId but that bill/authorize at the org level (MESITA-1545). `null`
 *  for a nonexistent place or one still in the public pool — `places
 *  .organization_id` is nullable there, by design (one place belongs to at
 *  most one organization). */
export async function orgIdForPlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("places")
    .select("organization_id")
    .eq("id", placeId)
    .maybeSingle();
  return (data as { organization_id?: string | null } | null)
    ?.organization_id ?? null;
}

/** 403s unless the caller holds one of `allowed` in the organization.
 *  Super-admins are NOT auto-allowed here: organization membership is a
 *  business fact, and an operator acting on an org should join it. */
export async function requireOrgRole(
  admin: SupabaseClient,
  user: AuthedUser,
  organizationId: string,
  allowed: OrgRole[],
): Promise<{ ok: true; role: OrgRole } | { ok: false; response: Response }> {
  const role = await orgRoleFor(admin, user, organizationId);
  if (!role || !allowed.includes(role)) {
    return {
      ok: false,
      response: json(
        { ok: false, error: "Not allowed on this organization" },
        403,
      ),
    };
  }
  return { ok: true, role };
}
