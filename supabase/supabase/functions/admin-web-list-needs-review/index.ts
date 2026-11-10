// Supabase Edge Function — admin-web-list-needs-review
//
// MESITA-3307 (W3): the purchases and payments in needs_review, newest
// first, 50 a page by a (created_at, id) cursor, each with uncovered_cents
// and Stripe's last error. `reopenable` rows were never paid (the cron gave
// up); the console's Re-read sends them back to the cron. Super-admin only.
//
// Body: { before?: { created_at, id } }
// Response: { ok, rows: [...], next }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("admin-web-list-needs-review", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const before = (bodyRes.body.before ?? null) as { created_at?: unknown; id?: unknown } | null;
  if (before && (typeof before.created_at !== "string" || Number.isNaN(Date.parse(before.created_at)) || !isUuid(before.id))) {
    return json({ ok: false, error: "before must be { created_at, id }" }, 400);
  }

  const { data, error } = await admin.rpc("wallet_needs_review_list", {
    p_before: before ? before.created_at : null,
    p_before_id: before ? before.id : null,
  });
  if (error) return json({ ok: false, error: `wallet_needs_review_list: ${error.message}` }, 500);
  const rows = (data ?? []) as { created_at: string; id: string }[];
  const last = rows.length === 50 ? rows[49] : null;
  return json({ ok: true, rows, next: last ? { created_at: last.created_at, id: last.id } : null });
});
