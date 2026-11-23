// Supabase Edge Function — consumer-web-list-stories
//
// MESITA-4738: Me › Tickets › Stories. The signed-in guest's own Instagram
// stories (the Post offer, MESITA-4714), newest first, in the wallet's money
// mode. Read-only. The work is _shared/list-stories.ts; the guest is the
// JWT's, never a body field.
//
// Body: none, or { story_id } for one story's ticket (MESITA-4747)
// Response: { ok: true, stories: [{ id, place: null | { id, name, slug,
//             photo_url }, state: checking|verified|rewarded|rejected,
//             credit_cents, currency, posted_at, decided_at, simulated }],
//             truncated }
//   `credit_cents`: what a rewarded story paid; null otherwise.
//   `truncated`: more than 50 stories exist.
//   With { story_id }: { ok: true, story: { id, place, state, posted_at,
//             checked_at, recheck_at, decided_at, reward_cents,
//             credit_cents, currency, reason, failed_at: check|recheck|null,
//             simulated } } (_shared/list-stories.ts StoryTicket): the five
//             steps of /me/tickets/stories/<id>. 400 a malformed id ·
//             404 not_found (no such story of this guest, in this mode).
//   401 sign_in · 500 { ok: false, error: "Couldn't load your stories",
//   request_id }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJsonOr, serveJson } from "../_shared/http.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { getStory, listStories } from "../_shared/list-stories.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("consumer-web-list-stories", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to see your stories" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const body = await readJsonOr<Record<string, unknown>>(req, {});
  if (body.story_id !== undefined) {
    if (!isUuid(body.story_id)) return json({ ok: false, error: "story_id must be a story id" }, 400);
    const one = await getStory(admin, user.id, paymentsLivemode(), body.story_id);
    if (!one.ok) return failWithRequestId("consumer-web-list-stories", "Couldn't load this story", one.error);
    if (!one.story) return json({ ok: false, code: "not_found", error: "This story is gone" }, 404);
    return json({ ok: true, story: one.story });
  }
  const res = await listStories(admin, user.id, paymentsLivemode());
  if (!res.ok) return failWithRequestId("consumer-web-list-stories", "Couldn't load your stories", res.error);
  return json({ ok: true, stories: res.stories, truncated: res.truncated });
});
