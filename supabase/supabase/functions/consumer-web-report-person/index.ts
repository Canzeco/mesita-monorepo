// Supabase Edge Function — consumer-web-report-person
//
// A signed-in guest reports the person behind one Social event.
// Body: { place_id, kind, at, reason, note? }
// The test guest's report is not stored.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { subjectOf } from "../_shared/social-subject.ts";

const REASONS = ["harassment", "spam", "inappropriate", "other"] as const;

serveJson("consumer-web-report-person", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user, testGuest } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const reason = body.reason;
  if (typeof reason !== "string" || !REASONS.includes(reason as (typeof REASONS)[number])) {
    return json({ ok: false, error: "reason" }, 400);
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (reason === "other" && note.length === 0) return json({ ok: false, error: "note_required" }, 400);
  if (note.length > 500) return json({ ok: false, error: "note" }, 400);
  const subject = await subjectOf(admin, body.place_id, body.kind, body.at);
  if (!subject.ok) return json({ ok: false, error: subject.error }, 404);
  if (subject.id === user.id) return json({ ok: false, error: "yourself" }, 400);
  if (testGuest) return json({ ok: true });
  const { error } = await admin.from("social_reports").insert({
    consumer_id: user.id,
    reported_id: subject.id,
    reason,
    note: note || null,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
});
