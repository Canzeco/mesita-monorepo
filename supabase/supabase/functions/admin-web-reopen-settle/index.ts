// Supabase Edge Function — admin-web-reopen-settle
//
// MESITA-3307 (W3): the needs_review list's Re-read. A row the cron gave up
// on (never paid) goes back to open with settle_tries 0, so the next tick
// re-reads it from Stripe (wallet_reopen_settle, MESITA-3305). A paid row is
// an uncovered refund and answers 409 not_available. Super-admin only.
//
// Body: { kind: "purchase" | "payment", id: uuid }
// Response: { ok, outcome: "reopened" }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("admin-web-reopen-settle", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { kind, id } = bodyRes.body;
  if ((kind !== "purchase" && kind !== "payment") || !isUuid(id)) {
    return json({ ok: false, error: "kind must be purchase or payment and id a uuid" }, 400);
  }

  const { data, error } = await admin.rpc("wallet_reopen_settle", { p_kind: kind, p_row_id: id });
  if (error) return json({ ok: false, error: `wallet_reopen_settle: ${error.message}` }, 500);
  const res = (data ?? {}) as { ok?: boolean; code?: string };
  if (!res.ok) {
    return json({ ok: false, code: "not_available", error: "Only a row that was never paid can be re-read" }, 409);
  }
  console.log("money_reopen_settle", JSON.stringify({ kind, id, actor: user.id }));
  return json({ ok: true, outcome: "reopened" });
});
