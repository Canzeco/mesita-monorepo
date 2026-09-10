"use server";

// Claim, release and verify, as server actions. They run with the caller's
// session cookie, so the EF sees the real user and its org-role guards apply
// — the browser never holds a token and never calls the EF directly.
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiClaimPlace,
  apiListConsolePlaces,
  apiReleasePlace,
} from "@/lib/api/organizations";
import { apiVerifyPlace } from "@/lib/api/place-verification";
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
  revalidatePath("/places/[id]", "page");
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
  revalidatePath("/places/[id]", "page");
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
  revalidatePath("/places/[id]", "page");
  return {
    error: null,
    note: result.alreadyVerified ? "Already verified." : "Verified.",
  };
}

/** The rail's list of this organization's places (MESITA-1715).
 *
 *  A server action rather than a fetch in `(shell)/layout.tsx`, because a
 *  layout cannot read searchParams and therefore cannot know WHICH
 *  organization is active — it would have had to guess `organizations[0]`,
 *  which is exactly the bug that made the header breadcrumb lie (MESITA-1713).
 *  The rail resolves the active org client-side and asks for that one.
 *
 *  Returns id and name only. The rail draws rows, not records, and shipping
 *  the full ConsolePlace would put addresses and intake state into a payload
 *  nothing renders.
 *
 *  NEVER THROWS. A rail that fails to list places must still be a rail: the
 *  console's whole navigation cannot go down because one EF call did.
 */
export async function listRailPlacesAction(
  organizationId: string,
): Promise<{ id: string; name: string }[]> {
  if (!organizationId) return [];
  const supabase = await createServerSupabase();
  try {
    const places = await apiListConsolePlaces(supabase, {
      scope: "org",
      organizationId,
    });
    return places
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.error("[rail] business-web-list-places:", e);
    return [];
  }
}
