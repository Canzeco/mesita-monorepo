// Supabase Edge Function — visit-web-confirm-charge
//
// MESITA-3545 (Payments Flow v2): the waiter's Received. The guest chose to
// pay the waiter's charge outside Mesita (cash or the place's terminal); the
// staff screen on visit.mesita.ai shows "Guest is paying $NMX outside" and
// one Received button, which calls this with the charge token only (the
// same key the screen polls with, never the place code). Received is the
// confirmer: wallet_confirm_outside marks the bill paid, spends the held
// credit and writes the cashback (2% when the place's Cashback switch was
// on when the bill opened), Pending one hour. Idempotent: a second tap
// answers already. Nothing for staff after it (Rules §2).
//
// Body: { token: 22 base64url chars } (never the place code)
// Response: { ok: true, outcome: paid | already_paid, payment_id,
//             outside_cents, cashback_cents, paid_at }
//   400 (not a token) · 404 gone (no such charge) ·
//   409 not_outside ("Not paying outside yet") | closed ("Cancelled by the
//       guest") | expired ("Expired") | forbidden (another place's bill)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { confirmCharge, isChargeToken, supabaseChargeStore } from "../_shared/charge.ts";

serveJson("visit-web-confirm-charge", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isChargeToken(token)) return json({ ok: false, error: "That is not a charge" }, 400);

  try {
    const res = await confirmCharge(supabaseChargeStore(admin), token);
    if (!res.ok) {
      console.log("[visit-web-confirm-charge]", JSON.stringify({ outcome: res.code ?? "refused" }));
      return json({ ok: false, code: res.code, error: res.error }, res.status);
    }
    // Never the token in a log line.
    console.log("[visit-web-confirm-charge]", JSON.stringify({
      outcome: res.outcome,
      payment_id: res.payment_id,
      place_id: res.place_id,
      cashback_cents: res.cashback_cents,
    }));
    return json({
      ok: true,
      outcome: res.outcome,
      payment_id: res.payment_id,
      outside_cents: res.outside_cents,
      cashback_cents: res.cashback_cents,
      paid_at: res.paid_at,
    });
  } catch (err) {
    return failWithRequestId("visit-web-confirm-charge", "Couldn't confirm. Try again.", err);
  }
});
