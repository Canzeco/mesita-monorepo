// Supabase Edge Function — visit-web-get-story
//
// MESITA-4304, MESITA-4405: the waiter's page on visit.mesita.ai/story/<token>
// reads the guest's story. The guest already paid; their Story screen shows
// the QR once a story is bound to their Story (story_bind). No sign-in: the
// token is the key to READ; approving needs the waiter code
// (visit-web-review-story). Logs carry the story id, never the token.
//
// Body: { token: 32 hex }
// Response: { ok: true, mention_id,
//             place: { id, name, instagram_handle },
//             instagram_handle (the guest's verified one),
//             state: waiting | approved | rejected | used (no open Story
//               holds it: past its deadline, refunded, or rebound),
//             story: { id, media_url, media_kind, mentioned_at, source, status: received | too_old },
//             reviewed_at, bonus_wait_sec, test_mode, server_time }
//   400 bad_request (not a token) · 404 gone (no story carries it: swept
//   after 24 hours, or a QR from before MESITA-4304) · 500 server

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isReviewToken, WAITER_STORY_COLUMNS, type WaiterStoryHolder, type WaiterStoryRow, waiterStoryView } from "../_shared/story-review.ts";
import { readStoryRules } from "../_shared/story-mention.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { instagramHandleOfUrl } from "../_shared/place-instagram.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { errorMessage } from "../_shared/errors.ts";

const FN = "visit-web-get-story";

serveJson("visit-web-get-story", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isReviewToken(token)) return json({ ok: false, code: "bad_request", error: "That is not a Story QR" }, 400);

  try {
    const { data, error } = await admin.from("story_mentions").select(WAITER_STORY_COLUMNS).eq("review_token", token).maybeSingle();
    if (error) throw new Error(`story_mentions: ${error.message}`);
    const row = data as WaiterStoryRow | null;
    if (!row || !row.review_place_id) {
      return json({ ok: false, code: "gone", error: "This Story QR is not valid. Ask the guest to show it again." }, 404);
    }
    const [placeRes, rules, holderRes] = await Promise.all([
      readVoucherPlace(admin, row.review_place_id),
      readStoryRules(admin),
      admin.from("stories").select("state, deadline_at").eq("mention_id", row.id).maybeSingle(),
    ]);
    if (holderRes.error) throw new Error(`stories: ${holderRes.error.message}`);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const place = {
      id: row.review_place_id,
      name: placeRes.place?.name ?? null,
      instagram_handle: instagramHandleOfUrl(placeRes.place?.instagram_url ?? null),
    };
    const view = waiterStoryView(row, (holderRes.data as WaiterStoryHolder) ?? null, place, !paymentsLivemode(), Date.now(), rules);
    return json({ ok: true, ...view });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ error: errorMessage(err) }));
    return json({ ok: false, code: "server", error: "Couldn't load this story. Try again" }, 500);
  }
});
