// Supabase Edge Function — consumer-web-list-stories
//
// MESITA-4738: Me › Tickets › Stories. The signed-in guest's own Instagram
// stories (the Post offer, MESITA-4714), newest first, in the wallet's money
// mode. Read-only. The work is _shared/list-stories.ts; the guest is the
// JWT's, never a body field.
//
// Body: none
// Response: { ok: true, stories: [{ id, place: null | { id, name, slug,
//             photo_url }, state: checking|verified|rewarded|rejected,
//             credit_cents, currency, posted_at, decided_at, simulated }],
//             truncated }
//   `credit_cents`: what a rewarded story paid; null otherwise.
//   `truncated`: more than 50 stories exist.
//   401 sign_in · 500 { ok: false, error: "Couldn't load your stories",
//   request_id }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { listStories } from "../_shared/list-stories.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("consumer-web-list-stories", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to see your stories" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const res = await listStories(admin, user.id, paymentsLivemode());
  if (!res.ok) return failWithRequestId("consumer-web-list-stories", "Couldn't load your stories", res.error);
  return json({ ok: true, stories: res.stories, truncated: res.truncated });
});
