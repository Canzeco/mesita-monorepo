// Supabase Edge Function — admin-web-list-app-feedback
//
// MESITA-3029: guest feedback about the app itself (public.app_feedback,
// written by consumer-web-send-feedback), read-only, newest first: the note,
// when, and the guest (first name and member number). Activity › Feedback
// shows it beside the place reports.
//
// Body: {} (ignored)
// Response: { ok: true, capped, feedback: AdminAppFeedback[] }
//   AdminAppFeedback = { id, consumer_id, first_name, member_number, note,
//                        created_at }
//   capped is true only when more than ROW_CAP rows exist.
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";

const ROW_CAP = 500;
// `.in()` travels in the GET query string; look up names in slices.
const LOOKUP_CHUNK = 100;

type FeedbackRow = { id: string; consumer_id: string; note: string; created_at: string };
type GuestRow = { id: string; first_name: string | null; code: string | null };

serveJson("admin-web-list-app-feedback", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const { data, error } = await admin
    .from("app_feedback")
    .select("id, consumer_id, note, created_at")
    .order("created_at", { ascending: false })
    .order("id")
    .limit(ROW_CAP + 1);
  if (error) {
    console.error("[admin-web-list-app-feedback] feedback_read", error.message);
    return json({ ok: false, error: `feedback_read: ${error.message}` }, 500);
  }
  const all = (data ?? []) as FeedbackRow[];
  const capped = all.length > ROW_CAP;
  const rows = all.slice(0, ROW_CAP);

  const guests = new Map<string, GuestRow>();
  const ids = [...new Set(rows.map((r) => r.consumer_id))];
  for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
    const g = await admin
      .from("consumers")
      .select("id, first_name, code")
      .in("id", ids.slice(i, i + LOOKUP_CHUNK));
    if (g.error) {
      console.error("[admin-web-list-app-feedback] guests_read", g.error.message);
      return json({ ok: false, error: `guests_read: ${g.error.message}` }, 500);
    }
    for (const row of (g.data ?? []) as GuestRow[]) guests.set(row.id, row);
  }

  return json({
    ok: true,
    capped,
    feedback: rows.map((r) => {
      const guest = guests.get(r.consumer_id);
      return {
        id: r.id,
        consumer_id: r.consumer_id,
        first_name: guest?.first_name?.trim() || null,
        member_number: guest?.code ?? null,
        note: r.note,
        created_at: r.created_at,
      };
    }),
  });
});
