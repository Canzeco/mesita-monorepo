// The guest's two Story-check EFs share this door (MESITA-4297):
// consumer-web-open-story-check mints or returns the check;
// consumer-web-get-story-check only reads it ({check: null} when none).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";
import { isUuid } from "./place-id.ts";
import { STORY_MIN_FOLLOWERS } from "./money-state.ts";
import { storyMode } from "./story-mention.ts";
import { paymentsLivemode } from "./stripe.ts";
import { readStoryGuest } from "./vouchers.ts";
import { readVoucherPlace } from "./wallet.ts";
import { guestCheckRefusal, openGuestCheck, readGuestCheck, viewCheck } from "./story-check.ts";
import { errorMessage } from "./errors.ts";

export async function storyCheckDoor(
  fn: string,
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  mint: boolean,
): Promise<Response> {
  const placeId = body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, code: "bad_request", error: "place_id must be a Mesita place id" }, 400);
  try {
    const placeRes = await readVoucherPlace(admin, placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    if (!placeRes.place || placeRes.place.state !== "active") {
      return json({ ok: false, code: "story_unavailable", error: "Story isn't available here right now" }, 409);
    }
    const guest = await readStoryGuest(admin, userId);
    const refusal = guestCheckRefusal(storyMode(), guest, STORY_MIN_FOLLOWERS);
    if (refusal) {
      const { status, ...rest } = refusal;
      return json({ ok: false, ...rest }, status);
    }
    const livemode = paymentsLivemode();
    const row = mint ? await openGuestCheck(admin, userId, placeId, livemode) : await readGuestCheck(admin, userId, placeId, livemode);
    if (!row) return json({ ok: true, check: null });
    const check = await viewCheck(admin, row, guest?.instagram_handle ?? null);
    if (mint) console.log(`[${fn}]`, JSON.stringify({ outcome: check.state, check_id: check.id, place_id: placeId }));
    return json({ ok: true, check });
  } catch (err) {
    console.error(`[${fn}]`, JSON.stringify({ place_id: placeId, error: errorMessage(err) }));
    return json({ ok: false, code: "server", error: "Couldn't load your Story. Try again" }, 500);
  }
}
