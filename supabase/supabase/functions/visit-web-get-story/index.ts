// Supabase Edge Function — visit-web-get-story
//
// MESITA-3507, MESITA-4264, MESITA-4297: the waiter's page on visit.mesita.ai
// reads a guest's story check (the Story QR on the Offers sheet, shown BEFORE
// the guest pays). No sign-in: the token is the key (approving needs the
// waiter code: visit-web-review-story). The answer names the place, the
// guest's verified Instagram handle, the check's state and the story to
// approve (or the one approved). The page polls it every `poll.every_ms` for
// `poll.for_ms` while it waits for a story.
//
// Body: { token: 32 hex }
// Response: { ok: true, check_id, id, token, url,
//             place: { id, name, instagram_handle, time_zone },
//             instagram_handle,
//             state: open | approved | used | expired,
//             story: { id, media_url, media_kind, mentioned_at, source, status } | null,
//             story_status: waiting | received | too_old,
//             last_rejected_at, approved_at, expires_at,
//             limits: { approve_valid_sec, max_story_age_sec, bonus_wait_sec },
//             test_mode, poll: { every_ms, for_ms }, server_time }
//   400 bad_request (not a token) · 404 gone (no check carries it) ·
//   410 story_token_retired (a Story QR from before MESITA-4297) · 500 server

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isStoryToken, readStaffStory, STAFF_POLL } from "../_shared/story.ts";

serveJson("visit-web-get-story", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isStoryToken(token)) return json({ ok: false, code: "bad_request", error: "That is not a Story QR" }, 400);

  const res = await readStaffStory(admin, token);
  if (!res.ok) {
    console.error("[visit-web-get-story]", JSON.stringify({ error: res.error }));
    return json({ ok: false, code: "server", error: "Couldn't load this story. Try again" }, 500);
  }
  if (res.kind === "retired") {
    return json({ ok: false, code: "story_token_retired", error: "Ask the guest to open the Story sheet again" }, 410);
  }
  if (res.kind === "none") return json({ ok: false, code: "gone", error: "This Story QR is not valid. Ask the guest to show it again." }, 404);
  return json({ ok: true, ...res.view, poll: STAFF_POLL, server_time: new Date().toISOString() });
});
