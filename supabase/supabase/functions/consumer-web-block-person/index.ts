// Supabase Edge Function — consumer-web-block-person
//
// A signed-in guest stops seeing the person behind one Social event.
// Body: { place_id, kind, at }
// The test guest's block is not stored.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { subjectOf } from "../_shared/social-subject.ts";

serveJson("consumer-web-block-person", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user, testGuest } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const subject = await subjectOf(admin, bodyRes.body.place_id, bodyRes.body.kind, bodyRes.body.at);
  if (!subject.ok) return json({ ok: false, error: subject.error }, 404);
  if (subject.id === user.id) return json({ ok: false, error: "yourself" }, 400);
  if (testGuest) return json({ ok: true });
  const { error } = await admin.from("social_blocks").upsert(
    { consumer_id: user.id, blocked_id: subject.id },
    { onConflict: "consumer_id,blocked_id" },
  );
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
});
