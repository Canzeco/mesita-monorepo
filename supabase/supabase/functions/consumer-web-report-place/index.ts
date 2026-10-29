// Supabase Edge Function — consumer-web-report-place
//
// MESITA-2684 (Pato, 2026-10-22: "three dots is a button to report"): a
// signed-in guest reports a Mesita place from the three dots on its screen.
// MESITA-3024: the report is guest feedback, append-only. Every send is its
// own row; Activity › Feedback lists them all.
//
// Body: { place_id: uuid, reason: string, note?: string }
//   reason  closed · wrong_info · wrong_links · wrong_location ·
//           inappropriate_photos · duplicate · other (_shared/place-reports.ts)
//   note    trimmed, at most 500 characters; required for `other`
// Response: { ok: true }
// Errors: 400 bad body (`note_required` for a blank `other`) · 404 place gone
//         · 429 too_many_reports (20 in the last hour from this guest)
//
// The flood cap counts, then inserts: two sends racing can land 21 or 22 in
// an hour, which is fine for a light cap. A failed count is logged and does
// not block the report (feedback beats the cap).
//
// A Google-only card (`g:<id>`) is refused: it is not a place row yet, and
// the place screen hides Report there.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { parsePlaceReport } from "../_shared/place-reports.ts";

const HOURLY_CAP = 20;

serveJson("consumer-web-report-place", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = parsePlaceReport(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const { placeId, reason, note } = parsed.report;
  const consumerId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const count = await admin
    .from("place_reports")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .gte("created_at", since);
  if (count.error) {
    console.error("[consumer-web-report-place] report_count", count.error.message);
  } else if ((count.count ?? 0) >= HOURLY_CAP) {
    console.warn("[consumer-web-report-place] too_many_reports", consumerId);
    return json({ ok: false, error: "too_many_reports" }, 429);
  }

  const { error } = await admin.from("place_reports").insert({
    consumer_id: consumerId,
    place_id: placeId,
    reason,
    note,
  });
  if (error) {
    // 23503: the place (or the consumer row) does not exist.
    const status = error.code === "23503" ? 404 : 500;
    console.error("[consumer-web-report-place] report_insert", error.message);
    return json({ ok: false, error: `report_insert: ${error.message}` }, status);
  }
  return json({ ok: true });
});
