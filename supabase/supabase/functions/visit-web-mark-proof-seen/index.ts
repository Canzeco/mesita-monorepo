// Supabase Edge Function — visit-web-mark-proof-seen
//
// MESITA-3304 (W2a): staff mark a payment proof seen on visit.mesita.ai. The
// stamp is set once; a second tap (or a second phone) answers the stored
// time, which is how the page and the guest's screen show "Already seen".
//
// Body: { token: 22 base64url chars }
// Response: { ok: true, seen_at }
//   400 (not a token) · 404 gone (no paid payment carries it)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isProofToken } from "../_shared/proof.ts";
import { markProofSeen } from "../_shared/pay.ts";

serveJson("visit-web-mark-proof-seen", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isProofToken(token)) return json({ ok: false, error: "That is not a payment proof" }, 400);

  const res = await markProofSeen(admin, token, new Date().toISOString());
  if (!res.ok) return json({ ok: false, error: res.error }, 500);
  if (!res.seenAt) return json({ ok: false, code: "gone", error: "This proof is not valid. Ask the guest to show it again." }, 404);
  console.log("[visit-web-mark-proof-seen]", JSON.stringify({ payment_id: res.paymentId, seen_at: res.seenAt }));
  return json({ ok: true, seen_at: res.seenAt });
});
