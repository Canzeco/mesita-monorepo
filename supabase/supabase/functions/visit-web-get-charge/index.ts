// Supabase Edge Function — visit-web-get-charge
//
// MESITA-3306 (W2c): the staff screen on visit.mesita.ai polls its charge
// every 3 s with the charge_token only, never the place code. It reads Paid
// when the payment row is paid; a stale or expired token answers 404 gone
// and writes no try. Never who paid.
//
// MESITA-3545: it also answers the tip (the charge's until a payment binds
// it, the payment's after), what moved on Mesita once paid (paid_cents: a
// lowered card part reads less than the bill), the outside bill waiting for
// Received (outside: { cents, tip_cents, expires_at }) and paid_outside.
//
// Body: { token: 22 base64url chars }
// Response: { ok: true, state: open | paid, amount_cents, tip_cents, paid_cents,
//             outside, paid_outside, currency, ticket, expires_at, paid_at, server_time }
//   400 (not a token) · 404 gone

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { getCharge, isChargeToken, supabaseChargeStore } from "../_shared/charge.ts";

serveJson("visit-web-get-charge", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isChargeToken(token)) return json({ ok: false, error: "That is not a charge" }, 400);

  const view = await getCharge(supabaseChargeStore(adminClient(envRes.env)), token, Date.now());
  if (!view) return json({ ok: false, code: "gone", error: "This charge is over. Open a new charge." }, 404);
  return json({ ok: true, ...view });
});
