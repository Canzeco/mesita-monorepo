// A changed Instagram or Facebook URL waits for the shared verifier
// before the save responds (MESITA-2189, MESITA-2227). The link is
// stored only when that account is connected. A miss refuses the save.
// An unchanged URL is not fetched. WhatsApp is not a reviews source.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import {
  type SocialLinksCheck,
  verifyChangedSocialLinks,
} from "../_shared/review-sources.ts";
import { type SocialUrlPair } from "../_shared/reviews-state.ts";

export { reviewsOwnedBodyKey as reviewsTileKeyInBody } from "../_shared/review-sources.ts";

export async function reviewPatchForSocialEdit(
  admin: SupabaseClient,
  placeId: string,
  update: Record<string, unknown>,
): Promise<SocialLinksCheck> {
  if (!("instagram_url" in update) && !("facebook_url" in update)) {
    return { ok: true, patch: {} };
  }
  const { data, error } = await admin
    .from("place_profiles")
    .select("instagram_url, facebook_url")
    .eq("id", placeId)
    .maybeSingle();
  if (error) console.error("[place-social] previous urls:", error.message);
  const row = (data ?? null) as SocialUrlPair | null;
  const prev: SocialUrlPair = {
    instagram_url: row?.instagram_url ?? null,
    facebook_url: row?.facebook_url ?? null,
  };
  return await verifyChangedSocialLinks({
    prev,
    next: {
      instagram_url: "instagram_url" in update
        ? (update.instagram_url as string | null)
        : undefined,
      facebook_url: "facebook_url" in update
        ? (update.facebook_url as string | null)
        : undefined,
    },
  });
}
