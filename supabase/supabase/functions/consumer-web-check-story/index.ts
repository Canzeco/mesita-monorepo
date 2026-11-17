// Supabase Edge Function — consumer-web-check-story
//
// MESITA-4296: the Story sheet's "Check my story", BEFORE Pay. Pato,
// 2026-11-17: "sí quiero hacer la verificación de la historia antes, que no
// pagues antes de eso". The guest posts a story mentioning @mesita (and the
// place's @handle, on trust: Meta reports only the @mesita mention); Meta's
// story_mention webhook (or the test-mode emulator) records it under the
// guest's verified handle; this finds it. The buy (consumer-web-buy-voucher)
// then reserves exactly that story and the credit claims it.
//
// The answer is a state, not an error: 200 with `found` and, when not found,
// the first reason that applies, in a fixed order (_shared/story-check.ts):
//   place_no_instagram → needs_instagram → few_followers → private_account →
//   already_bought → story_unavailable → not_available → no_story →
//   story_too_old
// `?poll=1` (the sheet's 5-second poll once the gate passed) skips the gate
// and only looks for the story.
//
// Body: { place_id: uuid }   Query: poll=1 (optional)
// Response: { ok: true, found: true, mention: { id, media_url, media_kind, mentioned_at, source },
//             place_handle, poll: { every_ms, for_ms } }
//         | { ok: true, found: false, reason, place_handle, poll }
//   400 bad_body (+field) · 401 (not signed in) · 404 place ·
//   500 check_failed (the sheet keeps polling; never reads as no_story)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { instagramHandleOfUrl } from "../_shared/place-instagram.ts";
import { readStoryGuest, storyRefusal, voucherOffer } from "../_shared/vouchers.ts";
import { mentionView, readCandidateMentions, readStoryRules, STORY_RULES, storyMode } from "../_shared/story-mention.ts";
import { storyCheck } from "../_shared/story-check.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { errorMessage } from "../_shared/errors.ts";

const FN = "consumer-web-check-story";
const POLL = { every_ms: STORY_RULES.pollEveryMs, for_ms: STORY_RULES.pollForMs };

serveJson("consumer-web-check-story", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const pollOnly = new URL(req.url).searchParams.get("poll") === "1";

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, code: "bad_body", field: "place_id", error: "place_id must be a Mesita place id" }, 400);

  try {
    const placeRes = await readVoucherPlace(admin, placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const place = placeRes.place;
    if (!place || place.state !== "active") return json({ ok: false, code: "place", error: "This place can't sell vouchers" }, 404);
    const placeHandle = instagramHandleOfUrl(place.instagram_url);
    const livemode = paymentsLivemode();
    const nowMs = Date.now();

    const [guest, offer, rules] = await Promise.all([
      readStoryGuest(admin, user.id),
      pollOnly ? Promise.resolve(null) : voucherOffer(admin, place, user.id, livemode),
      readStoryRules(admin),
    ]);
    const handle = guest?.instagram_handle?.toLowerCase() ?? null;
    const candidates = handle ? await readCandidateMentions(admin, handle, livemode, nowMs, user.id) : [];
    const offerReason = offer && !offer.sell.includes("voucher_story") ? (offer.unavailable.voucher_story ?? "off") : null;
    const res = storyCheck({
      placeInstagram: placeHandle !== null,
      guestRefusal: storyRefusal("voucher_story", guest)?.code ?? null,
      offerReason,
      mode: storyMode(),
      candidates,
      livemode,
      nowMs,
      rules,
      pollOnly,
    });
    if (!pollOnly || res.found) {
      console.log(`[${FN}]`, JSON.stringify({ place_id: placeId, found: res.found, reason: res.found ? null : res.reason, poll: pollOnly }));
    }
    if (res.found) return json({ ok: true, found: true, mention: mentionView(res.mention), place_handle: placeHandle, poll: POLL });
    return json({ ok: true, found: false, reason: res.reason, place_handle: placeHandle, poll: POLL });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ place_id: placeId, poll: pollOnly, error: errorMessage(err) }));
    return json({ ok: false, code: "check_failed", error: "Couldn't check your story. Trying again" }, 500);
  }
});
