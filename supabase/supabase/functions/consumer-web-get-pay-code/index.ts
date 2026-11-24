// Supabase Edge Function — consumer-web-get-pay-code
//
// MESITA-4823 (waiter-led pay, _shared/pay-bill.ts): the guest's one QR and
// the guest's poll. `mint: true` makes a new QR token (the
// screen asks when it opens and before they expire); a poll never mints.
// `bill_id` is the bill the screen already shows; without it the answer is the
// newest bill that is not over.
//
// Body: { mint?: boolean, bill_id?: uuid }
// Response: { ok: true, code: { url, expires_at } | null (only when minted),
//             bill: { id, state, version, currency, bill_cents, tip_cents,
//                     quote, expires_at, attempt_id, tab_id, test_mode,
//                     place: { id, name, photo_url } } | null, server_time }
//   401 sign_in

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { readWalletPlaces } from "../_shared/wallet.ts";
import { callTabRpc } from "../_shared/tab.ts";
import { guestBillView, hashPayCode, mintPayCode, readBill, readBillAttempt, readGuestActiveBill } from "../_shared/pay-bill.ts";

serveJson("consumer-web-get-pay-code", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { mint, bill_id: billId } = bodyRes.body;

  try {
    const nowMs = Date.now();
    let code: { url: string; expires_at: string } | null = null;
    if (mint === true) {
      const c = mintPayCode();
      const r = await callTabRpc(admin, "pay_guest_code_set", { p_consumer_id: user.id, p_token_hash: await hashPayCode(c.token) });
      if (r.ok !== true) throw new Error("pay_guest_code_set: refused");
      code = { url: c.url, expires_at: String(r.expires_at) };
    }

    let found: Awaited<ReturnType<typeof readGuestActiveBill>> = null;
    if (isUuid(billId)) {
      const bill = await readBill(admin, billId);
      if (bill && bill.consumer_id === user.id) found = { bill, attempt: await readBillAttempt(admin, bill) };
    }
    found ??= await readGuestActiveBill(admin, user.id, paymentsLivemode(), nowMs);
    let bill = null;
    if (found) {
      const placesRes = await readWalletPlaces(admin, [found.bill.place_id]);
      if (!placesRes.ok) throw new Error(placesRes.error);
      const place = placesRes.places.get(found.bill.place_id);
      bill = {
        ...guestBillView(found.bill, found.attempt, nowMs),
        place: { id: found.bill.place_id, name: place?.name ?? null, photo_url: place?.photo ?? null },
      };
    }
    return json({ ok: true, code, bill, server_time: new Date(nowMs).toISOString() });
  } catch (err) {
    return failWithRequestId("consumer-web-get-pay-code", "Couldn't load your QR. Try again.", err);
  }
});
