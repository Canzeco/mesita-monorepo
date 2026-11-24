// Supabase Edge Function — visit-web-type-bill
//
// MESITA-4883: what the waiter is typing, for the guest's screen (Write Bill).
// Display only: the guest's live QR is the key, no place and no waiter is named
// yet, and nothing reads it for money. The bill itself is visit-web-send-bill's.
//
// Body: { token, bill_cents, tip_cents, step: bill | tip | code }
// Response: { ok: true } · 400 bad_request · 404 code_gone

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { callTabRpc } from "../_shared/tab.ts";
import { hashPayCode, readCents, TYPING_STEPS } from "../_shared/pay-bill.ts";
import { isProofToken } from "../_shared/proof.ts";

serveJson("visit-web-type-bill", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { token, step } = bodyRes.body;
  const bill = readCents(bodyRes.body.bill_cents, 0);
  const tip = readCents(bodyRes.body.tip_cents, 0);
  if (!isProofToken(token) || bill === null || tip === null || !(TYPING_STEPS as readonly unknown[]).includes(step)) {
    return json({ ok: false, code: "bad_request", error: "That is not a bill being typed" }, 400);
  }
  try {
    const r = await callTabRpc(ctx.admin, "pay_guest_draft_set", {
      p_token_hash: await hashPayCode(token),
      p_bill_cents: bill,
      p_tip_cents: tip,
      p_step: step,
    });
    return r.ok === true ? json({ ok: true }) : json({ ok: false, code: "code_gone", error: "That QR expired. Scan the guest's QR again." }, 404);
  } catch (err) {
    return failWithRequestId("visit-web-type-bill", "Couldn't reach Mesita.", err);
  }
});
