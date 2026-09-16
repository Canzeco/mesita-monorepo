// The public place pool: one predicate, used by BOTH the listing and the
// claim. If they diverge, a stranger claims a place the list correctly hid.
//
// A place is claimable when NOBODY OWNS IT and it has never been claimed:
// no `place_members` row with role `owner`, and `places.claimed_at` null.
//
// THE OWNER ROW IS THE FACT (MESITA-1892). This used to read
// `places.organization_id is null` and then correct itself with the owner
// check, because a place claimed the old way (business-web-create-place ->
// admin-web-decide-verification inserts the owner row) had a real operator
// and no organization, so it would sit in the pool looking free. The
// organization column is gone and the correction was always the real
// predicate — `claim_place_into_org` refused an owned place too. What
// `claimed_at` adds is the OTHER half: a place claimed from the pool whose
// owner row was later removed must not silently re-enter it, because
// `claimed_by`/`claimed_at` are the provenance the admin review queue reads.
// Release is what clears both (release_place), and release is a deliberate,
// owner-only act.
//
// Ownership verification is out of scope for now, so a claim is an
// assertion rather than a proof. That makes this predicate the ONLY thing
// standing between the pool and someone else's live restaurant.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Ids of places that already have a direct owner, so they are NOT in the
 *  pool however they came to have one. */
export async function placeIdsWithDirectOwner(
  admin: SupabaseClient,
): Promise<Set<string>> {
  const { data } = await admin
    .from("place_members")
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
  const [place, owner] = await Promise.all([
    admin
      .from("places")
      .select("claimed_at")
      .eq("id", placeId)
      .maybeSingle(),
    admin
      .from("place_members")
      .select("id")
      .eq("place_id", placeId)
      .eq("role", "owner")
      .maybeSingle(),
  ]);
  if (!place.data) return false;
  const claimedAt = (place.data as { claimed_at: string | null }).claimed_at;
  return claimedAt === null && !owner.data;
}
