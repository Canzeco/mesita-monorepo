// Supabase Edge Function — consumer-web-get-story-reward
//
// MESITA-4714 (Post, the Offers page's third tab): what a story pays at one
// place and where this guest's latest story there stands. The place's
// story_reward_cents (0 = Off, also where Loyalty Cards is Off), its Instagram
// handle when its profile names one, whether the guest has a linked
// Instagram, the 7-day window, and in Stripe test mode that the guest can
// simulate a story. Signed out: the amount only.
//
// Body: { place_id: uuid }
// Response: { ok: true, post: { reward_cents, currency, place_handle,
//             signed_in, instagram_linked, instagram_handle, simulate,
//             next_at, latest: null | { id, state: checking|verified|rewarded|rejected, recheck_at,
//             reward_cents, available_at, reason, posted_at, simulated } } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { getOptionalAuthedUser } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { readCashbackRates } from "../_shared/cashback.ts";
import { readPost } from "../_shared/story-reward.ts";

serveJson("consumer-web-get-story-reward", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const { user } = await getOptionalAuthedUser(req, env);
  const res = await readPost(
    admin,
    { placeId, consumerId: user?.id ?? null, livemode: paymentsLivemode(), nowMs: Date.now() },
    (id) => readCashbackRates(admin, id),
  );
  if (!res.ok) return json({ ok: false, error: res.error }, res.status);
  return json({ ok: true, post: res.post });
});
