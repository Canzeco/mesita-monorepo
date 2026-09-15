"use server";

// Claim, release, verify, and the Add place ceremony (create then claim).
// They run with the caller's session cookie, so the EF sees the real user
// and its org-role guards apply — the browser never holds a token and never
// calls the EF directly.
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiClaimPlace,
  apiListOrganizations,
  apiReleasePlace,
} from "@/lib/api/organizations";
import { apiCreatePlace } from "@/lib/api/place-search";
import { apiVerifyPlace } from "@/lib/api/place-verification";
import { canAddPlace, findOrg } from "@/lib/active-organization";
import { efCode } from "@/lib/api/_invoke";
import { errMsg } from "@/lib/utils";

export type PlaceActionState = { error: string | null };

/** Verify carries a success note as well as a failure one: "already
 *  verified" is neither an error nor a silent no-op, and the row has no
 *  other way to say so. */
export type PlaceVerifyActionState = PlaceActionState & {
  note: string | null;
};

export async function claimPlaceAction(
  _prev: PlaceActionState,
  formData: FormData,
): Promise<PlaceActionState> {
  const placeId = String(formData.get("placeId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!placeId || !organizationId) return { error: "Missing place or organization." };

  const supabase = await createServerSupabase();
  try {
    await apiClaimPlace(supabase, { placeId, organizationId });
  } catch (e) {
    return { error: errMsg(e, "Couldn't claim that place.") };
  }
  // Both lists change: the place leaves the pool and joins the portfolio.
  // So does Place itself — its Holding section is the thing that just moved.
  revalidatePath("/places");
  revalidatePath("/places/[id]", "layout");
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
  revalidatePath("/places");
  revalidatePath("/places/[id]", "layout");
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
  revalidatePath("/places");
  revalidatePath("/places/[id]", "layout");
  return {
    error: null,
    note: result.alreadyVerified ? "Already verified." : "Verified.",
  };
}

/** Outcome of Add / Create on the ceremony. Success is this org holding
 *  the place (`heldPlaceId`). A 409 on create is never treated as Add —
 *  the client re-looks up. Claim failing after a mint leaves `retryPlaceId`
 *  so the card can retry Add without celebrating the mint. */
export type AddPlaceResult = {
  error: string | null;
  heldPlaceId?: string;
  alreadyExists?: boolean;
  retryPlaceId?: string;
};

function revalidateHold() {
  revalidatePath("/places");
  revalidatePath("/places/[id]", "layout");
  revalidatePath("/orgs/[orgId]", "layout");
}

const OWNER_ONLY = "Only the owner can add a place to this organization.";

/** ONE PLACE PER ORGANIZATION, REFUSED AND NOT MERELY HIDDEN (MESITA-1879).
 *
 *  Pato: *"You can now only manage one place for organization."* The console
 *  hides the Add door once an organization holds one — but a hidden door is
 *  not a closed one. A stale tab, a bookmarked ceremony, `/orgs/<id>/places`
 *  (still live, still reachable) or a super-admin can all still post here, and
 *  a second place drops the organization into the multi-place fallback for
 *  good.
 *
 *  It says WHICH place it already holds, because "you already have one" with
 *  no name is a dead end on a screen the operator came to precisely because
 *  they could not find it.
 *
 *  NOT A DATABASE CONSTRAINT, deliberately: `places.organization_id` keeps its
 *  cardinality so franchises need no migration to come back (see the
 *  comment-only migration this issue ships). The accepted cost is that this is
 *  read-then-refuse, so two tabs racing can both pass — blast radius is one
 *  extra place, which the console then explains rather than hiding. */
function alreadyHoldsPlace(org: { places: readonly { name: string }[] }): string | null {
  const first = org.places[0];
  if (!first) return null;
  return `This organization already holds ${first.name}. Open it, or contact support to add a second place.`;
}

/** Ceremony Create/Add are owner-only, and one-place. `business-web-create-place`
 *  only checks a signed-in user, so both gates must run before mint or an
 *  editor could leave an unowned catalogue row after a 403 claim. */
async function requireCeremonyOwner(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
): Promise<string | null> {
  let orgs;
  try {
    orgs = await apiListOrganizations(supabase);
  } catch (e) {
    return errMsg(e, "Couldn't load organizations.");
  }
  const org = findOrg(orgs, organizationId);
  if (!org || !canAddPlace(org.myRole)) return OWNER_ONLY;
  return alreadyHoldsPlace(org);
}

/** Claim a listed Mesita place into this organization (the Add card). */
export async function addListedPlaceAction(
  placeId: string,
  organizationId: string,
): Promise<AddPlaceResult> {
  if (!placeId || !organizationId) {
    return { error: "Missing place or organization." };
  }
  const supabase = await createServerSupabase();
  const denied = await requireCeremonyOwner(supabase, organizationId);
  if (denied) return { error: denied };
  try {
    await apiClaimPlace(supabase, { placeId, organizationId });
  } catch (e) {
    return { error: errMsg(e, "Couldn't add that place.") };
  }
  revalidateHold();
  return { error: null, heldPlaceId: placeId };
}

/** Mint from Google, then claim into this organization (the Create card).
 *  Two EFs, one browser hop. */
export async function createThenClaimAction(
  googlePlaceId: string,
  organizationId: string,
): Promise<AddPlaceResult> {
  if (!googlePlaceId || !organizationId) {
    return { error: "Missing place or organization." };
  }
  const supabase = await createServerSupabase();
  const denied = await requireCeremonyOwner(supabase, organizationId);
  if (denied) return { error: denied };
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
    await apiClaimPlace(supabase, {
      placeId: created.id,
      organizationId,
    });
  } catch (e) {
    return {
      error: errMsg(
        e,
        "Place created, but it couldn't be added to this organization.",
      ),
      retryPlaceId: created.id,
    };
  }
  revalidateHold();
  return { error: null, heldPlaceId: created.id };
}
