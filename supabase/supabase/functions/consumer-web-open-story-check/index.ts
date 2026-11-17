// Supabase Edge Function — consumer-web-open-story-check
//
// MESITA-4297: the Offers Story sheet's Show QR step: mints the guest's story
// check at this place (or returns the open/approved one); its token is the QR
// the waiter scans.
// The check lives in the current payments mode; an approved check lets
// the guest buy the Story voucher until expires_at.
//
// Body: { place_id: uuid }
// Response: { ok: true, check: { id, token, url, state: open | approved | used | expired,
//             story: { id, media_url, media_kind, mentioned_at, source, status } | null,
//             story_status: waiting | received | too_old,
//             last_rejected_at, approved_at, expires_at,
//             limits: { approve_valid_sec, max_story_age_sec, bonus_wait_sec }, test_mode } }
//   400 bad_request · 401 (not signed in) · 403 needs_instagram |
//   few_followers { min_followers, followers } · 409 story_unavailable · 500 server

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { storyCheckDoor } from "../_shared/story-check-door.ts";

serveJson("consumer-web-open-story-check", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  return storyCheckDoor("consumer-web-open-story-check", ctx.admin, ctx.user.id, bodyRes.body, true);
});
