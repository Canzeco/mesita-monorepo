// Supabase Edge Function — consumer-web-send-credit
//
// MESITA-3292: the signed-in guest sends some of their credit at one place
// to a friend, as a one-time link. The credit leaves their balance at once
// (wallet_send_credit, under the pair lock, spendable only, ten open links
// per place); the friend takes it at the same place with
// consumer-web-claim-credit; the sender can take it back with
// consumer-web-take-back-credit while it is open. In live mode it refuses
// until app_config.money_config.sending_live is true (the lawyer,
// MESITA-3274); in test mode it is always on.
//
// Body: { place_id: uuid, amount_cents: integer > 0, request_id: uuid }
// Response: { ok: true, outcome: "sent" | "already_sent", gift_id,
//             amount_cents, currency, token: string | null,
//             code: string | null, test_mode }
//   token is the link's key and code its 12 digits (MESITA-3737), both
//   shown once; a replay (already_sent) answers null for both, since only
//   their hashes are stored. The client builds the link:
//   <its origin>/wallet/gift/<token>.
//   400 amount_required | above_cap · 401 sign_in · 404 gone ·
//   409 not_live | insufficient (spendable_cents) | too_many_open | taken ·
//   500 with request_id

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { GIFT_MAX_OPEN, giftRefusalStatus, hashGiftCode, hashGiftToken, mintGiftCode, mintGiftToken, readSendBody } from "../_shared/gift.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { readMoneyConfig, sendingOn } from "../_shared/money-config.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("consumer-web-send-credit", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to send credit" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readSendBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
  const input = parsed.input;

  const livemode = paymentsLivemode();
  const config = await readMoneyConfig(admin);
  if (!sendingOn(config, livemode)) {
    return json({ ok: false, code: "not_live", error: "Sending credit isn't open yet" }, 409);
  }

  const placeRes = await readVoucherPlace(admin, input.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  if (!placeRes.place) return json({ ok: false, code: "gone", error: "That place isn't here" }, 404);
  const currency = String(placeRes.place.currency ?? MONEY_CURRENCY).toLowerCase();

  const token = mintGiftToken();
  const code = mintGiftCode();
  const { data, error } = await admin.rpc("wallet_send_credit", {
    p_sender_id: userId,
    p_place_id: input.placeId,
    p_amount_cents: input.amountCents,
    p_currency: currency,
    p_livemode: livemode,
    p_request_id: input.requestId,
    p_token_hash: await hashGiftToken(token),
    p_max_open: GIFT_MAX_OPEN,
    p_code_hash: await hashGiftCode(code),
  });
  if (error) {
    console.error("[consumer-web-send-credit] rpc", error.message);
    return json({ ok: false, error: "Couldn't send. Try again.", request_id: input.requestId }, 500);
  }
  const res = data as {
    ok: boolean; code?: string; outcome?: string; gift_id?: string; amount_cents?: number;
    currency?: string; spendable_cents?: number;
  };
  console.log("[consumer-web-send-credit]", JSON.stringify({ outcome: res.outcome ?? res.code, place_id: input.placeId }));
  if (!res.ok) {
    return json({
      ok: false,
      code: res.code,
      error: res.code === "insufficient" ? "That's more than you can send here" : "Couldn't send that",
      ...(res.spendable_cents !== undefined ? { spendable_cents: res.spendable_cents } : {}),
      ...(res.gift_id ? { gift_id: res.gift_id } : {}),
    }, giftRefusalStatus(res.code));
  }
  return json({
    ok: true,
    outcome: res.outcome,
    gift_id: res.gift_id,
    amount_cents: res.amount_cents,
    currency: res.currency,
    token: res.outcome === "sent" ? token : null,
    code: res.outcome === "sent" ? code : null,
    test_mode: !livemode,
  });
});
