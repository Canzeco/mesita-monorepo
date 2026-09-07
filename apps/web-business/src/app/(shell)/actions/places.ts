"use server";

// Claim and release, as server actions. They run with the caller's session
// cookie, so the EF sees the real user and its org-role guards apply — the
// browser never holds a token and never calls the EF directly.
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiClaimPlace, apiReleasePlace } from "@/lib/api/organizations";
import { errMsg } from "@/lib/utils";

export type PlaceActionState = { error: string | null };

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
