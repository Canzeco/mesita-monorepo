"use server";

// Claim, release, verify, and the Add place ceremony (create then claim).
// They run with the caller's session cookie, so the EF sees the real user
// and its guards apply — the browser never holds a token and never calls the
// EF directly.
//
// CLAIMING IS FOR YOURSELF NOW (MESITA-1892). `claim_place_into_org` took an
// organization and an owner-of-that-organization check; `claim_place(p_place_id,
// p_claimer)` mints the CALLER's own `place_members` owner row. So every
// action here takes a place and nothing else, and the role gate that used to
// sit in front of them has no subject: there is no membership to hold before
// you hold the place. The EF still refuses a place that is not in the pool,
// which is the only refusal that was ever about the place rather than the
// holder.
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiClaimPlace, apiReleasePlace } from "@/lib/api/console";
import { apiCreatePlace } from "@/lib/api/place-search";
import { apiVerifyPlace } from "@/lib/api/place-verification";
import { efCode } from "@/lib/api/_invoke";
import { errMsg } from "@/lib/utils";

export type PlaceActionState = { error: string | null };

/** Verify carries a success note as well as a failure one: "already
 *  verified" is neither an error nor a silent no-op, and the row has no
 *  other way to say so. */
export type PlaceVerifyActionState = PlaceActionState & {
  note: string | null;
};

/** Both lists change: the place leaves the pool and joins your portfolio. So
 *  does the place itself — and so does the RAIL, whose rows are drawn from
 *  the viewer the shell layout fetched. */
function revalidateHold() {
  revalidatePath("/places");
  revalidatePath("/places/[id]", "layout");
}

export async function claimPlaceAction(
  _prev: PlaceActionState,
  formData: FormData,
): Promise<PlaceActionState> {
  const placeId = String(formData.get("placeId") ?? "");
  if (!placeId) return { error: "Missing place." };

  const supabase = await createServerSupabase();
  try {
    await apiClaimPlace(supabase, { placeId });
  } catch (e) {
    return { error: errMsg(e, "Couldn't claim that place.") };
  }
  revalidateHold();
  return { error: null };
}

export async function releasePlaceAction(
  _prev: PlaceActionState,
  formData: FormData,
): Promise<PlaceActionState> {
  const placeId = String(formData.get("placeId") ?? "");
  if (!placeId) return { error: "Missing place." };

  const supabase = await createServerSupabase();
  try {
    await apiReleasePlace(supabase, { placeId });
  } catch (e) {
    return { error: errMsg(e, "Couldn't release that place.") };
  }
  revalidateHold();
  return { error: null };
}

export async function verifyPlaceAction(
  _prev: PlaceVerifyActionState,
  formData: FormData,
): Promise<PlaceVerifyActionState> {
  const placeId = String(formData.get("placeId") ?? "");
  if (!placeId) return { error: "Missing place.", note: null };

  const supabase = await createServerSupabase();
  let result;
  try {
    result = await apiVerifyPlace(supabase, { placeId });
  } catch (e) {
    return { error: errMsg(e, "Couldn't verify that place."), note: null };
  }
  // Verified is a column on the list and a fact on the place, so both
  // re-read — same pair claim and release already invalidate.
  revalidateHold();
  return {
    error: null,
    note: result.alreadyVerified ? "Already verified." : "Verified.",
  };
}

/** Outcome of Add / Create on the ceremony. Success is the caller holding
 *  the place (`heldPlaceId`). A 409 on create is never treated as Add —
 *  the client re-looks up. Claim failing after a mint leaves `retryPlaceId`
 *  so the row can retry Add without celebrating the mint. */
export type AddPlaceResult = {
  error: string | null;
  heldPlaceId?: string;
  alreadyExists?: boolean;
  retryPlaceId?: string;
};

// THERE IS NO `requireCeremonyOwner` ANY MORE, and no one-place refusal
// (MESITA-1892).
//
// Both were the organization's. Create and Claim were owner-of-the-org,
// because claiming wrote `places.organization_id` and an organization's
// portfolio was somebody's to control; and MESITA-1879 refused a SECOND place
// on top of that, because Pato had folded the console down to one place per
// organization and a stale tab could still post a second one.
//
// The column is gone and the RPC mints the claimer's own owner row, so there
// is nobody above the caller to be an owner of, and nothing whose cardinality
// a second place would break: a manager holds exactly as many places as they
// have `place_members` rows. Both gates are deleted rather than reworded,
// because a gate with no subject is a lock drawn on a door with no bolt in it.

/** Claim a listed Mesita place (the Add row's "On Mesita" verb). */
export async function addListedPlaceAction(
  placeId: string,
): Promise<AddPlaceResult> {
  if (!placeId) return { error: "Missing place." };
  const supabase = await createServerSupabase();
  try {
    await apiClaimPlace(supabase, { placeId });
  } catch (e) {
    return { error: errMsg(e, "Couldn't add that place.") };
  }
  revalidateHold();
  return { error: null, heldPlaceId: placeId };
}

/** Mint from Google, then claim it (the Add row's "Not on Mesita" verb).
 *  Two EFs, one browser hop. */
export async function createThenClaimAction(
  googlePlaceId: string,
): Promise<AddPlaceResult> {
  if (!googlePlaceId) return { error: "Missing place." };
  const supabase = await createServerSupabase();
  let created: Awaited<ReturnType<typeof apiCreatePlace>>;
  try {
    created = await apiCreatePlace(supabase, googlePlaceId);
  } catch (e) {
    if (efCode(e) === "place_already_exists") {
      return {
        error: "This place is already on Mesita.",
        alreadyExists: true,
      };
    }
    return { error: errMsg(e, "Couldn't create that place.") };
  }
  if (!created?.id) {
    return { error: "Created place is missing an id." };
  }
  try {
    await apiClaimPlace(supabase, { placeId: created.id });
  } catch (e) {
    return {
      error: errMsg(e, "Place created, but it couldn't be claimed."),
      retryPlaceId: created.id,
    };
  }
  revalidateHold();
  return { error: null, heldPlaceId: created.id };
}
