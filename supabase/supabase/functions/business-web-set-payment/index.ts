// Supabase Edge Function — business-web-set-payment
//
// MESITA-3296: Business › Payments, one setting at a time. The owner and
// Mesita staff only: it is the place's money.
//
// MESITA-3589: the Place states of Main §10. A switch (House Credits, Cash
// Payments, Mesita Payments, or one of the six Prepaid Vouchers) on or off,
// or a cashback rate (card or cash) as whole percents 1..20, or Off.
// The rules, each with the one step that unlocks it:
//   - House Credits On needs a signed House Credits Contract (SQL refuses
//     too). House Credits Off turns the vouchers off with it, since they
//     sell House Credits; credit guests already hold stays spendable.
//   - A voucher On needs House Credits On (SQL refuses too).
//   - Cash Payments On needs the place code (the waiter's Received).
//   - While Mesita Payments is on, the cash rate is never above the card
//     rate (SQL refuses too; turning Mesita Pay on over it answers the same).
//
// Body: { place_id: uuid, key: house_credits|cash_payments|pay_cards|voucher_*, enabled: boolean }
//    or { place_id: uuid, key: card_cashback_bps|cash_cashback_bps, bps: 100..2000 (whole percents) | null }
// Response: { ok: true, settings: { ...every setting } }
//   409 { code: needs_contract | needs_house_credits | needs_place_code | cash_above_card }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { MONEY_VOUCHER_KEYS } from "../_shared/money-state.ts";
import { isPaymentKey, isRateKey, isValidCashbackBps, readContract, readSettings } from "../_shared/payments.ts";

serveJson("business-web-set-payment", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, key, enabled, bps } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  // A stale Payments tab can still send a setting that left (Cash, Credits,
  // MESITA-3408; Cashback, MESITA-3589): its own code and an owner-facing
  // line, shown as-is.
  if (!isPaymentKey(key) && !isRateKey(key)) {
    return json({ ok: false, code: "unknown_switch", error: "This page changed. Reload to see the new settings." }, 400);
  }
  if (isPaymentKey(key) && typeof enabled !== "boolean") {
    return json({ ok: false, code: "invalid", error: "enabled must be true or false" }, 400);
  }
  if (isRateKey(key) && bps !== null && !isValidCashbackBps(bps)) {
    return json({ ok: false, code: "invalid", error: "Cashback is a whole percent from 1% to 20%, or Off" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const current = await readSettings(admin, placeId);
  const patch: Record<string, unknown> = {};

  if (isPaymentKey(key)) {
    const on = enabled as boolean;
    if (key === "house_credits" && on) {
      const contract = await readContract(admin, placeId);
      if (!contract.signed) {
        return json({ ok: false, code: "needs_contract", error: "Sign the House Credits Agreement first." }, 409);
      }
    }
    if (key === "house_credits" && !on) {
      // Prepaid Vouchers sell House Credits: they go off with it.
      for (const v of MONEY_VOUCHER_KEYS) patch[v] = false;
    }
    if ((MONEY_VOUCHER_KEYS as readonly string[]).includes(key) && on && !current.house_credits) {
      return json({ ok: false, code: "needs_house_credits", error: "Turn House Credits on first." }, 409);
    }
    if (key === "cash_payments" && on) {
      const { data: code, error: codeErr } = await admin.from("place_codes").select("place_id").eq("place_id", placeId).maybeSingle();
      if (codeErr) return json({ ok: false, error: `place_codes: ${codeErr.message}` }, 500);
      if (!code) {
        return json({ ok: false, code: "needs_place_code", error: "Set the place code first: your waiters confirm cash with it." }, 409);
      }
    }
    patch[key] = on;
  } else {
    const next = { ...current, [key]: bps as number | null };
    if (next.pay_cards && next.cash_cashback_bps !== null && next.card_cashback_bps !== null && next.cash_cashback_bps > next.card_cashback_bps) {
      return json({ ok: false, code: "cash_above_card", error: "Cash cashback can't be higher than Mesita Pay cashback." }, 409);
    }
    patch[key] = bps;
  }

  const { error } = await admin.from("place_payment_settings").upsert({
    place_id: placeId,
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) {
    // The SQL guards answer in their own words; say the owner's step.
    if (error.message.includes("house_credits_unsigned")) {
      return json({ ok: false, code: "needs_contract", error: "Sign the House Credits Agreement first." }, 409);
    }
    if (error.message.includes("prepay_needs_house_credits")) {
      return json({ ok: false, code: "needs_house_credits", error: "Turn House Credits on first." }, 409);
    }
    if (error.message.includes("cash_le_card")) {
      return json({ ok: false, code: "cash_above_card", error: "Cash cashback can't be higher than Mesita Pay cashback." }, 409);
    }
    return json({ ok: false, error: `place_payment_settings: ${error.message}` }, 500);
  }

  return json({ ok: true, settings: await readSettings(admin, placeId) });
});
