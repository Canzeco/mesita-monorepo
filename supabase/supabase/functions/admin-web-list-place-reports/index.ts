// Supabase Edge Function — admin-web-list-place-reports
//
// Guest reports (public.place_reports, written by consumer-web-report-place),
// read-only, newest first: the reason, the optional note, when, the guest
// (first name and member number) and the place (id and name). Reports are
// append-only (MESITA-3024), so a guest who reported twice shows twice.
//
//   { placeId } (or the legacy { projectId }) — one place: Single Place ›
//                                               Admin › Reports (MESITA-2686)
//   { all: true }                             — every place: Activity › Feedback
//                                               (MESITA-3024)
//   anything else                             — 400 (_shared/place-reports.ts)
//
// Response: { ok: true, capped, reports: AdminPlaceReport[] }
//   AdminPlaceReport = { id, place_id, place_name, consumer_id, first_name,
//                        member_number, reason, note, created_at }
//   capped is true only when more than ROW_CAP rows exist.
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { parseReportListBody } from "../_shared/place-reports.ts";

const ROW_CAP = 500;
// `.in()` travels in the GET query string; 500 uuids is ~18 KB, so look up
// names in slices.
const LOOKUP_CHUNK = 100;

type ReportRow = {
  id: string;
  place_id: string;
  consumer_id: string;
  reason: string;
  note: string | null;
  created_at: string;
};

type GuestRow = { id: string; first_name: string | null; code: string | null };
type PlaceRow = { id: string; name: string | null };

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += LOOKUP_CHUNK) {
    out.push(items.slice(i, i + LOOKUP_CHUNK));
  }
  return out;
}

serveJson("admin-web-list-place-reports", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = parseReportListBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const { scope } = parsed;

  let query = admin
    .from("place_reports")
    .select("id, place_id, consumer_id, reason, note, created_at");
  if (scope.kind === "place") query = query.eq("place_id", scope.placeId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .limit(ROW_CAP + 1);
  if (error) {
    console.error("[admin-web-list-place-reports] reports_read", error.message);
    return json({ ok: false, error: `reports_read: ${error.message}` }, 500);
  }
  const all = (data ?? []) as ReportRow[];
  const capped = all.length > ROW_CAP;
  const rows = all.slice(0, ROW_CAP);

  const guests = new Map<string, GuestRow>();
  for (const ids of chunks([...new Set(rows.map((r) => r.consumer_id))])) {
    const g = await admin
      .from("consumers")
      .select("id, first_name, code")
      .in("id", ids);
    if (g.error) {
      console.error("[admin-web-list-place-reports] guests_read", g.error.message);
      return json({ ok: false, error: `guests_read: ${g.error.message}` }, 500);
    }
    for (const row of (g.data ?? []) as GuestRow[]) guests.set(row.id, row);
  }

  const places = new Map<string, PlaceRow>();
  for (const ids of chunks([...new Set(rows.map((r) => r.place_id))])) {
    const p = await admin.from("profiles").select("id, name").in("id", ids);
    if (p.error) {
      console.error("[admin-web-list-place-reports] places_read", p.error.message);
      return json({ ok: false, error: `places_read: ${p.error.message}` }, 500);
    }
    for (const row of (p.data ?? []) as PlaceRow[]) places.set(row.id, row);
  }

  return json({
    ok: true,
    capped,
    reports: rows.map((r) => {
      const guest = guests.get(r.consumer_id);
      return {
        id: r.id,
        place_id: r.place_id,
        place_name: places.get(r.place_id)?.name?.trim() || "Unnamed place",
        consumer_id: r.consumer_id,
        first_name: guest?.first_name?.trim() || null,
        member_number: guest?.code ?? null,
        reason: r.reason,
        note: r.note,
        created_at: r.created_at,
      };
    }),
  });
});
