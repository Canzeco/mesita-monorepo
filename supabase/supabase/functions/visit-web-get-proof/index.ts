// Supabase Edge Function — visit-web-get-proof
//
// MESITA-3304 (W2a): the staff page on visit.mesita.ai reads a payment proof.
// No sign-in there: the 128-bit token in the QR is the key. The answer says
// what Mesita received at which place and when, the server's clock, and
// whether staff already saw it; never who paid.
//
// Body: { token: 22 base64url chars }
// Response: { ok: true, place: { name }, amount_cents, currency, paid_at,
//             status, seen_at, server_time, test_mode, ticket }
//   400 (not a token) · 404 gone (no paid payment carries it)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isProofToken } from "../_shared/proof.ts";
import { proofView, readProof } from "../_shared/pay.ts";

serveJson("visit-web-get-proof", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isProofToken(token)) return json({ ok: false, error: "That is not a payment proof" }, 400);

  const res = await readProof(admin, token);
  if (!res.ok) return json({ ok: false, error: res.error }, 500);
  if (!res.row) return json({ ok: false, code: "gone", error: "This proof is not valid. Ask the guest to show it again." }, 404);
  return json({ ok: true, ...proofView(res.row, res.placeName, new Date().toISOString()) });
});
