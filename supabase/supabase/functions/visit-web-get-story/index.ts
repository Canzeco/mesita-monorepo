// Supabase Edge Function — visit-web-get-story
//
// MESITA-3507, MESITA-4264: the staff page on visit.mesita.ai reads a Story
// voucher. No sign-in: the token in the guest's QR is the key (approving
// needs the waiter code: visit-web-review-story). The answer names the
// place, the buyer's verified Instagram handle, where the Story stands, and
// every unclaimed story of that handle in the last 24 hours (the
// candidates staff approve one of), newest first. The page polls this every
// `poll.every_ms` for `poll.for_ms` while it waits for a story.
//
// Body: { token: 32 hex }
// Response: { ok: true, purchase_id,
//             place: { id, name, instagram_handle, time_zone },
//             instagram_handle, amount_cents, bonus_cents, credit_cents,
//             currency, paid_at, approved_at, activated_at (= approved_at),
//             refunded (status is not paid), status,
//             state: needs_story | received | rejected | approved | released | void,
//             review: approved | rejected | null, reviewed_at, recheck_at,
//             bonus_at, bonus: released | void | null,
//             bonus_void_reason: unreachable | expired | refunded | operator | null,
//             bonus_decided_at, expires_at,
//             mentions: [{ id, media_url, media_kind: image | video, mentioned_at, source: meta | emulator }],
//             claimed_mention: { …same } | null,
//             test_mode, poll: { every_ms, for_ms }, server_time }
//   400 bad_request (not a token) · 404 gone (no paid Story carries it) · 500 server

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isStoryToken, readStory } from "../_shared/story.ts";
import { STORY_RULES } from "../_shared/story-mention.ts";

serveJson("visit-web-get-story", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isStoryToken(token)) return json({ ok: false, code: "bad_request", error: "That is not a Story voucher" }, 400);

  const res = await readStory(admin, token);
  if (!res.ok) {
    console.error("[visit-web-get-story]", JSON.stringify({ error: res.error }));
    return json({ ok: false, code: "server", error: "Couldn't load this voucher. Try again" }, 500);
  }
  if (!res.row) return json({ ok: false, code: "gone", error: "This Story voucher is not valid. Ask the guest to show it again." }, 404);
  return json({
    ok: true,
    ...res.view,
    poll: { every_ms: STORY_RULES.staffPollEveryMs, for_ms: STORY_RULES.staffPollForMs },
    server_time: new Date().toISOString(),
  });
});
