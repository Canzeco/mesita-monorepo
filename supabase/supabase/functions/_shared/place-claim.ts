// The public place pool: one predicate, used by BOTH the listing and the
// claim. If they diverge, a stranger claims a place the list correctly hid.
//
// A place is claimable when it is in no organization AND nobody holds it
// directly through project_members. `organization_id is null` alone is not
// enough: a place claimed the old way (business-web-create-project ->
// admin-web-decide-verification inserts the owner row) has a real operator
// and no organization, so it would sit in the pool looking free.
//
// Ownership verification is out of scope for now, so a claim is an
// assertion rather than a proof. That makes this predicate the ONLY thing
// standing between the pool and someone else's live restaurant.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Ids of places that already have a direct owner, so they are NOT in the
 *  pool no matter what organization_id says. */
export async function placeIdsWithDirectOwner(
  admin: SupabaseClient,
): Promise<Set<string>> {
  const { data } = await admin
    .from("project_members")
    .select("place_id")
    .eq("role", "owner");
  return new Set(((data ?? []) as { place_id: string }[]).map((r) => r.place_id));
}

/** Is this one place claimable right now? Reads the same two facts the
 *  listing filters on. */
export async function isPlaceClaimable(
  admin: SupabaseClient,
  placeId: string,
): Promise<boolean> {
  const [proj, owner] = await Promise.all([
    admin
      .from("projects")
      .select("organization_id")
      .eq("id", placeId)
      .maybeSingle(),
    admin
      .from("project_members")
      .select("id")
      .eq("place_id", placeId)
      .eq("role", "owner")
      .maybeSingle(),
  ]);
  if (!proj.data) return false;
  const orgId = (proj.data as { organization_id: string | null }).organization_id;
  return orgId === null && !owner.data;
}
