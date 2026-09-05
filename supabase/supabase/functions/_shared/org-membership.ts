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
