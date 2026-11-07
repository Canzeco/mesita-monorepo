// Supabase Edge Function — consumer-web-get-payment
//
// MESITA-3304 (W2a): one of the signed-in guest's paid payments, so
// /pay?payment=<id> shows its proof again after a reload or from the
// Wallet's history, and the Pay page can see when staff marked it seen.
// A refunded payment still answers and reads Refunded.
//
// Body: { payment_id: uuid }
// Response: { ok: true, payment_id, place: { id, name }, status, amount_cents,
//             credit_cents, currency, paid_at, proof_seen_at,
//             proof: { token, url } | null, test_mode }
//   401 sign_in · 404 gone (not theirs, or never paid)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentView, readPayment } from "../_shared/pay.ts";

serveJson("consumer-web-get-payment", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to see your payment" }, 401);

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const paymentId = bodyRes.body.payment_id;
  if (!isUuid(paymentId)) return json({ ok: false, error: "payment_id must be a uuid" }, 400);

  const res = await readPayment(adminClient(envRes.env), authRes.user.id, paymentId);
  if (!res.ok) return json({ ok: false, error: res.error }, 500);
  if (!res.row) return json({ ok: false, code: "gone", error: "That payment isn't here" }, 404);
  return json({ ok: true, ...paymentView(res.row, res.placeName) });
});
