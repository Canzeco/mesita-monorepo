// Supabase Edge Function — visit-web-get-story
//
// MESITA-3507: the staff page on visit.mesita.ai reads a Story voucher
// waiting for activation. No sign-in: the token in the guest's QR is the
// key. The answer names the place, the buyer's Instagram handle (staff match
// it to the story), the credit, and whether it is already active.
//
// Body: { token: 32 hex }
// Response: { ok: true, place: { name }, instagram_handle, amount_cents,
//             credit_cents, currency, paid_at, activated_at, refunded,
//             test_mode, server_time }
//   400 (not a token) · 404 gone (no paid Story carries it)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isStoryToken, readStory, storyView } from "../_shared/story.ts";

serveJson("visit-web-get-story", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isStoryToken(token)) return json({ ok: false, error: "That is not a Story voucher" }, 400);

  const res = await readStory(admin, token);
  if (!res.ok) return json({ ok: false, error: res.error }, 500);
  if (!res.row) return json({ ok: false, code: "gone", error: "This Story voucher is not valid. Ask the guest to show it again." }, 404);
  return json({ ok: true, ...storyView(res.row, res.placeName, res.handle), server_time: new Date().toISOString() });
});
