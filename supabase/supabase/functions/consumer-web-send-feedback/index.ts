// Supabase Edge Function — consumer-web-send-feedback
//
// MESITA-3029: a signed-in guest sends feedback about the app itself, not a
// place (Settings › Your account › Send feedback). Every send is its own row
// in public.app_feedback; admin reads them on Activity › Feedback.
//
// Body: { note: string }   trimmed, 1–1000 characters (_shared/app-feedback.ts)
// Response: { ok: true }
// Errors: 400 note_required / too long · 429 too_much_feedback (10 in the last
//         hour from this guest)
//
// The flood cap counts, then inserts, like consumer-web-report-place: a race
// can land one or two over, which is fine for a light cap. A failed count is
// logged and does not block the send (feedback beats the cap).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { parseAppFeedback } from "../_shared/app-feedback.ts";

const HOURLY_CAP = 10;

serveJson("consumer-web-send-feedback", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = parseAppFeedback(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const consumerId = user.id;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const count = await admin
    .from("app_feedback")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .gte("created_at", since);
  if (count.error) {
    console.error("[consumer-web-send-feedback] feedback_count", count.error.message);
  } else if ((count.count ?? 0) >= HOURLY_CAP) {
    console.warn("[consumer-web-send-feedback] too_much_feedback", consumerId);
    return json({ ok: false, error: "too_much_feedback" }, 429);
  }

  const { error } = await admin.from("app_feedback").insert({
    consumer_id: consumerId,
    note: parsed.note,
  });
  if (error) {
    // 23503: the consumer row does not exist.
    const status = error.code === "23503" ? 404 : 500;
    console.error("[consumer-web-send-feedback] feedback_insert", error.message);
    return json({ ok: false, error: `feedback_insert: ${error.message}` }, status);
  }
  return json({ ok: true });
});
