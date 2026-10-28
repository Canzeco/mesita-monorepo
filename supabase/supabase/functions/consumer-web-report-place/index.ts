// Supabase Edge Function — consumer-web-report-place
//
// MESITA-2684 (Pato, 2026-10-22: "three dots is a button to report"): a
// signed-in guest reports a Mesita place from the three dots on its screen.
// One live report per member × place: a second report replaces the first
// and moves created_at forward.
//
// Body: { place_id: uuid, reason: string, note?: string }
//   reason  closed · wrong_info · wrong_location · inappropriate_photos ·
//           duplicate · other (_shared/place-reports.ts)
//   note    optional, trimmed, at most 500 characters
// Response: { ok: true }
//
// A Google-only card (`g:<id>`) is refused: it is not a place row yet, and
// the opening screen keeps its dots inert.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { parsePlaceReport } from "../_shared/place-reports.ts";

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

  const admin = adminClient(envRes.env);
  const { error } = await admin.from("place_reports").upsert(
    {
      consumer_id: authRes.user.id,
      place_id: placeId,
      reason,
      note,
      created_at: new Date().toISOString(),
    },
    { onConflict: "consumer_id,place_id" },
  );
  if (error) {
    // 23503: the place (or the consumer row) does not exist.
    const status = error.code === "23503" ? 404 : 500;
    return json({ ok: false, error: `report_upsert: ${error.message}` }, status);
  }
  return json({ ok: true });
});
