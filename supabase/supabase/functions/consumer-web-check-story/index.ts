// Supabase Edge Function — consumer-web-check-story
//
// MESITA-4405: the Story pays FIRST; this is the Story screen's look.
//
//   { story_id }   the guest's Story screen poll (every 5 s, every 15 s after
//                  2 minutes, stopping at approved, void or the deadline):
//                  while the Story waits for a post it tries story_bind (the
//                  newest fitting story of the guest's verified handle; a
//                  story rejected at this place never binds here), then
//                  answers the Story as consumer-web-get-story does. Only the
//                  Story's owner: anyone else reads 404.
//   { place_id }   the Story gate only (Offers): may this guest buy the Story
//                  voucher here? `found` is always false; `reason` is the
//                  first that applies, in a fixed order (_shared/story-check.ts):
//                  place_no_instagram → needs_instagram → few_followers →
//                  private_account → already_bought → story_unavailable →
//                  not_available; null when the guest may buy.
//
// Response: { ok: true, story: StoryView }            (story_id)
//         | { ok: true, found: false, reason, place_handle }   (place_id)
//   400 bad_body (+field) · 401 (not signed in) · 404 not_found | place ·
//   500 check_failed (the screen keeps polling)
// Logs: one `found` Story line when the poll binds a story (ids only).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { instagramHandleOfUrl } from "../_shared/place-instagram.ts";
import { readStoryGuest, storyEligibilityContext, storyRefusal, voucherOffer } from "../_shared/vouchers.ts";
import { storyMode } from "../_shared/story-mention.ts";
import { storyGate } from "../_shared/story-check.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { errorMessage } from "../_shared/errors.ts";
import { bindStory, readOwnStory, storyNeedsPoll } from "../_shared/story.ts";
import { readStoryScreen } from "../_shared/story-screen.ts";
import { storyLog } from "../_shared/story-log.ts";

const FN = "consumer-web-check-story";

serveJson("consumer-web-check-story", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { story_id: storyId, place_id: placeId } = bodyRes.body;

  if (storyId !== undefined) {
    if (!isUuid(storyId)) return json({ ok: false, code: "bad_body", field: "story_id", error: "story_id must be a uuid" }, 400);
    try {
      let s = await readOwnStory(admin, user.id, { storyId });
      if (!s) return json({ ok: false, code: "not_found", error: "Story not found" }, 404);
      const nowMs = Date.now();
      if (s.state === "waiting_post" && storyNeedsPoll(s, nowMs)) {
        const r = await bindStory(admin, s.id);
        if (r.outcome === "found") {
          storyLog("found", { story_id: s.id, purchase_id: s.purchase_id, place_id: s.place_id, livemode: s.livemode, via: "screen" });
          s = (await readOwnStory(admin, user.id, { storyId })) ?? s;
        }
      }
      return json({ ok: true, story: await readStoryScreen(admin, s, nowMs) });
    } catch (err) {
      console.error(`[${FN}]`, JSON.stringify({ story_id: storyId, error: errorMessage(err) }));
      return json({ ok: false, code: "check_failed", error: "Couldn't check your story. Trying again" }, 500);
    }
  }

  if (!isUuid(placeId)) return json({ ok: false, code: "bad_body", field: "place_id", error: "place_id must be a Mesita place id" }, 400);
  try {
    const placeRes = await readVoucherPlace(admin, placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const place = placeRes.place;
    if (!place || place.state !== "active") return json({ ok: false, code: "place", error: "This place can't sell vouchers" }, 404);
    const placeHandle = instagramHandleOfUrl(place.instagram_url);
    const [guest, offer, storyCtx] = await Promise.all([
      readStoryGuest(admin, user.id),
      voucherOffer(admin, place, user.id, paymentsLivemode()),
      storyEligibilityContext(admin),
    ]);
    const offerReason = !offer.sell.includes("voucher_story") ? (offer.unavailable.voucher_story ?? "off") : null;
    const reason = storyGate({
      placeInstagram: placeHandle !== null,
      guestRefusal: storyRefusal("voucher_story", guest, storyCtx)?.code ?? null,
      offerReason,
      mode: storyMode(),
    });
    return json({ ok: true, found: false, reason, place_handle: placeHandle });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ place_id: placeId, error: errorMessage(err) }));
    return json({ ok: false, code: "check_failed", error: "Couldn't check. Try again" }, 500);
  }
});
