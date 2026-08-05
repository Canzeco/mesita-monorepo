// Claimed ownership = project_members.role 'owner' (OTP / admin approval).
// listing_type 'partner' is a separate catalog/discovery flag, not ownership.
//
// Invariant (MESITA-919): at most one owner per place. Transfer = promote a
// member to owner (demotes the previous owner to editor). Enforced in
// business-web-update-member-role + partial unique index.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export async function placeHasVerifiedOwner(
  admin: SupabaseClient,
  projectId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from("project_members")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("role", "owner");
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function isLastOwnerOfPlace(
  admin: SupabaseClient,
  projectId: string,
): Promise<boolean> {
  const { count } = await admin
    .from("project_members")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("role", "owner");
  return (count ?? 0) <= 1;
}

/**
 * Make `memberId` the sole owner of `projectId`. Any other owners are demoted
 * to editor first so the partial unique index stays happy.
 */
export async function transferPlaceOwnership(
  admin: SupabaseClient,
  projectId: string,
  memberId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const demote = await admin
    .from("project_members")
    .update({ role: "editor" })
    .eq("project_id", projectId)
    .eq("role", "owner")
    .neq("id", memberId);
  if (demote.error) {
    return { ok: false, error: `owner_demote: ${demote.error.message}` };
  }

  const promote = await admin
    .from("project_members")
    .update({ role: "owner" })
    .eq("id", memberId)
    .eq("project_id", projectId)
    .select("id, role")
    .single();
  if (promote.error) {
    return { ok: false, error: `owner_promote: ${promote.error.message}` };
  }
  if (!promote.data || promote.data.role !== "owner") {
    return { ok: false, error: "Ownership transfer failed." };
  }
  return { ok: true };
}
