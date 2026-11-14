// Supabase Edge Function — visit-web-verify-tab
//
// MESITA-3707 (guest pays, waiter verifies): the waiter scanned the guest's
// QR (visit.mesita.ai/tab/<token>) and taps Verify. Any phone signed in with
// the waiter code may verify (MESITA-3734: there is no Staff QR): its staff
// token must be a current `s2` token of the tab's place (_shared/staff.ts),
// which carries the device id kept below. An older `s1` token answers
// staff_code_needed: type the waiter code again.
// pay_tab_verify does the rest under the pair lock: cash is confirmed with the
// shortfall rules and its 2% cashback written; a tab paid in the app is only
// stamped; a second Verify moves no money; a card still going through waits.
// The phone that verified is kept as a hash of its device id, never the token.
//
// Body: { token: the tab's QR token, place_id: the staff token's place,
//         staff_token, cash_received_cents? (empty = exactly what is owed) }
// MESITA-3856: a bill with a held card is captured first (pay_tab_begin_capture
// → captureHeldCard); 202 confirming while Stripe has not answered, 409
// capture_failed when the charge failed (nothing charged, the bill ends).
// Response: { ok: true, outcome: verified | already_verified | confirming, verified_at,
//             same_phone?, cash_received_cents?, cash_tip_cents?,
//             cashback_cents? }
//   400 bad_request | amount_required · 403 staff_code_needed | forbidden ·
//   404 gone · 409 short (+missing_cents) | card_pending | expired |
//   cancelled | not_paid

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { MAX_PAYMENT_INPUT_CENTS } from "../_shared/money.ts";
import { readStaffToken, staffDeviceHash, supabaseStaffStore } from "../_shared/staff.ts";
import { callTabRpc, isTabToken, readTabByToken, rpcRefusal } from "../_shared/tab.ts";
import { captureHeldCard } from "../_shared/settle-payment.ts";
import { paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("visit-web-verify-tab", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { token, place_id: placeId, staff_token: staffToken, cash_received_cents: received } = bodyRes.body;
  if (!isTabToken(token)) return json({ ok: false, code: "bad_request", error: "That is not a guest's payment" }, 400);
  if (!isUuid(placeId)) return json({ ok: false, code: "bad_request", error: "place_id must be a Mesita place id" }, 400);
  if (typeof staffToken !== "string" || staffToken.length > 128) {
    return json({ ok: false, code: "staff_code_needed", error: "Type the waiter code" }, 403);
  }
  if (received !== undefined && received !== null
      && (typeof received !== "number" || !Number.isInteger(received) || received < 0 || received > MAX_PAYMENT_INPUT_CENTS)) {
    return json({ ok: false, code: "amount_required", error: "Type the cash you received" }, 400);
  }

  try {
    const keys = await supabaseStaffStore(admin).keys(placeId);
    const info = await readStaffToken(env.serviceKey, placeId, staffToken, keys, Date.now());
    if (!info || !info.jti) {
      console.log("[visit-web-verify-tab]", JSON.stringify({ outcome: "staff_code_needed", place_id: placeId, version: info?.version ?? null }));
      return json({ ok: false, code: "staff_code_needed", error: "Type the waiter code" }, 403);
    }
    const tab = await readTabByToken(admin, token);
    if (!tab || tab.origin !== "guest") {
      return json({ ok: false, code: "gone", error: "Scan the guest's screen again." }, 404);
    }
    if (tab.place_id !== placeId) {
      return json({ ok: false, code: "forbidden", error: "This payment is for another place." }, 403);
    }

    const keyHash = await staffDeviceHash(info.jti);
    // MESITA-3856: a held card is captured first; the capture's settle signs
    // the bill. Anything Stripe has not answered yet reads Confirming.
    const begin = await callTabRpc(admin, "pay_tab_begin_capture", { p_tab_id: tab.id, p_place_id: placeId, p_staff_key_hash: keyHash });
    if (begin.ok !== true) {
      const refusal = rpcRefusal(begin);
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    if (begin.outcome === "capture") {
      const key = paymentsStripeKey();
      if (!key) return json({ ok: false, code: "not_configured", error: "Card payments are off" }, 503);
      const out = await captureHeldCard(admin, stripeClient(key), {
        tabId: tab.id,
        paymentId: String(begin.payment_id),
        paymentIntent: String(begin.payment_intent),
        account: String(begin.stripe_account_id),
      });
      console.log("[visit-web-verify-tab]", JSON.stringify({ outcome: `capture_${out}`, tab_id: tab.id, place_id: placeId }));
      if (out === "failed") {
        return json({ ok: false, code: "capture_failed", error: "The card charge failed. Nothing was charged." }, 409);
      }
      if (out === "confirming") return json({ ok: true, outcome: "confirming" }, 202);
    }

    const r = await callTabRpc(admin, "pay_tab_verify", {
      p_tab_id: tab.id,
      p_place_id: placeId,
      p_staff_key_hash: keyHash,
      p_received_cents: typeof received === "number" ? received : null,
    });
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[visit-web-verify-tab]", JSON.stringify({ outcome: refusal.code, tab_id: tab.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    // Never a token or the device id in a log line.
    console.log("[visit-web-verify-tab]", JSON.stringify({
      outcome: r.outcome,
      tab_id: tab.id,
      place_id: placeId,
      cashback_cents: r.cashback_cents ?? 0,
      same_phone: r.same_phone ?? null,
    }));
    return json({
      ok: true,
      outcome: r.outcome,
      verified_at: r.verified_at ?? null,
      same_phone: r.same_phone ?? null,
      cash_received_cents: r.cash_received_cents ?? null,
      cash_tip_cents: r.cash_tip_cents ?? null,
      cashback_cents: r.cashback_cents ?? 0,
    });
  } catch (err) {
    return failWithRequestId("visit-web-verify-tab", "Couldn't verify. Try again.", err);
  }
});
