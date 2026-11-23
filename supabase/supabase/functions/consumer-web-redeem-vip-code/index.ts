// Supabase Edge Function — consumer-web-redeem-vip-code
//
// MESITA-4766: Me › Become VIP. A signed-in guest types an invitation code
// an operator issued (admin-web-save-vip-code); consumer_redeem_vip_invitation
// checks it in one transaction (the guest's row locked, the code claimed by
// one statement, every failure logged). The guest is always the caller's
// session, never a body field. The code is never logged.
//
// Body: { code } — twelve digits; spaces and dashes are ignored.
// 200 { ok: true, outcome: "joined" }       the code was used; the guest is VIP
// 200 { ok: true, outcome: "already_vip" }  nothing used or set
// 400 { ok: false, code: "invalid_code_format" }  not twelve digits (not counted)
// 422 { ok: false, code: "code_invalid" }   unknown, used or revoked (counted)
// 429 { ok: false, code: "too_many_tries", retryAfterSeconds }  10 counted an hour
// 404 { ok: false, code: "consumer_not_found" }
// 500 { ok: false, code: "save_failed", requestId }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { readRedeemVipCodeBody, redeemAnswer } from "../_shared/vip-codes.ts";

serveJson("consumer-web-redeem-vip-code", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const parsed = readRedeemVipCodeBody(await readJsonOr<unknown>(req, {}));
  if (!parsed.ok) {
    return json({ ok: false, code: "invalid_code_format", error: "An invitation code is 12 digits." }, 400);
  }

  const { data, error } = await admin.rpc("consumer_redeem_vip_invitation", {
    p_consumer: user.id,
    p_code: parsed.code,
    p_livemode: paymentsLivemode(),
  });
  if (error) {
    const requestId = crypto.randomUUID();
    console.error("[consumer-web-redeem-vip-code]", JSON.stringify({ request_id: requestId, error: error.message }));
    return json({ ok: false, code: "save_failed", error: "Couldn't check the code. Try again.", requestId }, 500);
  }
  const answer = redeemAnswer(data);
  console.log("vip_code_redeem", JSON.stringify({ outcome: answer.body.outcome ?? answer.body.code }));
  return json(answer.body, answer.status);
});
