// Supabase Edge Function — consumer-web-get-story
//
// MESITA-4405: one Story for its screen (Me › Tickets › Stories, and the
// landing right after a Story buy). Read only: the screen's poll that binds
// a posted story is consumer-web-check-story. Only the Story's owner; anyone
// else reads 404, never someone else's Story.
//
// Body: { story_id: uuid } | { purchase_id: uuid }
// Response: { ok: true, story: { story_id, purchase_id, place_id, place_name,
//             state: waiting_post | found | approved | released | void,
//             deadline_at, created_at, paid_at, amount_cents, bonus_cents,
//             credit_cents, currency, refunded, approved_at, bonus_at,
//             decided_at, void_reason, first_bound_at,
//             mention: { id, media_url, media_kind, mentioned_at, source, deleted } | null,
//             review_url (the waiter QR, while found), place_handle, time_zone,
//             test_mode, emulator, poll: { every_ms, slow_after_ms, slow_every_ms } | null,
//             server_time } }
//   400 bad_body · 401 (not signed in) · 404 not_found (none, or not yours;
//   right after a buy the Story may not exist yet: try again) · 500 server

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { errorMessage } from "../_shared/errors.ts";
import { readOwnStory } from "../_shared/story.ts";
import { readStoryScreen } from "../_shared/story-screen.ts";

const FN = "consumer-web-get-story";

serveJson("consumer-web-get-story", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { story_id: storyId, purchase_id: purchaseId } = bodyRes.body;
  if (!isUuid(storyId) && !isUuid(purchaseId)) {
    return json({ ok: false, code: "bad_body", error: "Body needs story_id or purchase_id" }, 400);
  }

  try {
    const s = await readOwnStory(admin, user.id, {
      storyId: isUuid(storyId) ? storyId : null,
      purchaseId: isUuid(purchaseId) ? purchaseId : null,
    });
    if (!s) return json({ ok: false, code: "not_found", error: "Story not found" }, 404);
    return json({ ok: true, story: await readStoryScreen(admin, s, Date.now()) });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ story_id: storyId ?? null, purchase_id: purchaseId ?? null, error: errorMessage(err) }));
    return json({ ok: false, code: "server", error: "Couldn't load your Story. Try again" }, 500);
  }
});
