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
import { serveJson } from "../_shared/http.ts";
import { handleListPlaceReports } from "../_shared/place-reports-handler.ts";

serveJson("admin-web-list-place-reports", (req) => handleListPlaceReports(req, "admin-web-list-place-reports"));
