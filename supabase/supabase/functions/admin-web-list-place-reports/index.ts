// Supabase Edge Function — admin-web-list-place-reports
//
// MESITA-2686: Single Place › Admin › Reports, read-only. One place's guest
// reports (public.place_reports, written by consumer-web-report-place,
// MESITA-2684), newest first: the reason, the optional note, when, and the
// guest (first name and member number). A report is one per guest × place;
// a second replaces the first, so this is also the count of guests who
// reported the place.
//
// Body:     { placeId | projectId }
// Response: { ok: true, reports: AdminPlaceReport[] }
//   AdminPlaceReport = { consumer_id, first_name, member_number, reason,
//                        note, created_at }
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  json,
  readJson,
  readPlaceIdAlias,
  serveJson,
} from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";

const ROW_CAP = 500;

type ReportRow = {
  consumer_id: string;
  reason: string;
  note: string | null;
  created_at: string;
};

type GuestRow = { id: string; first_name: string | null; code: string | null };

serveJson("admin-web-list-place-reports", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const { data, error } = await admin
    .from("place_reports")
    .select("consumer_id, reason, note, created_at")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);
  if (error) {
    console.error("[admin-web-list-place-reports]", error.message);
    return json({ ok: false, error: `reports_read: ${error.message}` }, 500);
  }
  const rows = (data ?? []) as ReportRow[];

  const ids = [...new Set(rows.map((r) => r.consumer_id))];
  const guests = new Map<string, GuestRow>();
  if (ids.length > 0) {
    const g = await admin
      .from("consumers")
      .select("id, first_name, code")
      .in("id", ids);
    if (g.error) {
      console.error("[admin-web-list-place-reports] guests", g.error.message);
      return json({ ok: false, error: `guests_read: ${g.error.message}` }, 500);
    }
    for (const row of (g.data ?? []) as GuestRow[]) guests.set(row.id, row);
  }

  return json({
    ok: true,
    capped: rows.length >= ROW_CAP,
    reports: rows.map((r) => {
      const guest = guests.get(r.consumer_id);
      return {
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
