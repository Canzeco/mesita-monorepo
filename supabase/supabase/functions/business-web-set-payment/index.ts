// Supabase Edge Function — business-web-set-payment
//
// MESITA-3296: Business › Payments, one setting at a time. The owner and
// Mesita staff only: it is the place's money.
//
// MESITA-3589: the Place states of Main §10. A switch (Loyalty Cards, Cash
// Payments, Mesita Payments, Mesita Prepayments (MESITA-3597), or one of its
// six vouchers) on or off.
// The rules, each with the one step that unlocks it:
//   - Loyalty Cards On needs a signed Loyalty Cards Agreement (SQL refuses
//     too). Loyalty Cards Off turns the vouchers off with it, since they
//     sell Loyalty Cards; credit guests already hold stays spendable.
//   - Mesita Prepayments On needs Loyalty Cards On (SQL refuses too) and,
//     as below, the Stripe Account taking cards. Loyalty Cards Off turns it
//     off too.
//   - A voucher On needs Loyalty Cards On (SQL refuses too). It sells only
//     while Mesita Prepayments is on as well (moneyState).
//   - Cash Payments On needs the place code (the waiter's Received).
//   - Mesita Payments, Mesita Prepayments and every voucher On need the place's
//     Stripe account, in the server's payments mode, to take cards
//     (MESITA-3599; SQL refuses too, in either mode). Off never needs it.
//
// Body: { place_id: uuid, key: stripe_payments|loyalty_cards|cash_payments|pay_cards|prepayments|voucher_*, enabled: boolean }
// Response: { ok: true, settings: { ...every setting } }
//   409 { code: needs_contract | needs_loyalty_cards | needs_place_code | needs_stripe }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { MONEY_VOUCHER_KEYS } from "../_shared/money-state.ts";
import { isPaymentKey, needsStripe, readAccount, readContract, readSettings, stripeStateOf } from "../_shared/payments.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

const NEEDS_STRIPE = { ok: false, code: "needs_stripe", error: "Connect the Stripe Account first: App Payments and App Prepayments need an account that takes cards." };

serveJson("business-web-set-payment", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, key, enabled } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  // A stale Payments tab can still send a setting that left (Cash, Credits,
  // MESITA-3408; the rates, MESITA-4194): its own code and an owner-facing
  // line, shown as-is.
  if (!isPaymentKey(key)) {
    return json({ ok: false, code: "unknown_switch", error: "This page changed. Reload to see the new settings." }, 400);
  }
  if (typeof enabled !== "boolean") {
    return json({ ok: false, code: "invalid", error: "enabled must be true or false" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const current = await readSettings(admin, placeId);
  const patch: Record<string, unknown> = {};

  const on = enabled;
  if (on && needsStripe(key)) {
    const account = await readAccount(admin, placeId);
    if (stripeStateOf(account, paymentsLivemode()) !== "charging") return json(NEEDS_STRIPE, 409);
  }

  if (key === "loyalty_cards" && on) {
    const contract = await readContract(admin, placeId);
    if (!contract.signed) {
      return json({ ok: false, code: "needs_contract", error: "Sign the Loyalty Cards Agreement first." }, 409);
    }
  }
  if (key === "loyalty_cards" && !on) {
    // Mesita Prepayments sells Loyalty Cards: it and its vouchers go off with it.
    patch.prepayments = false;
    for (const v of MONEY_VOUCHER_KEYS) patch[v] = false;
  }
  if (key === "prepayments" && on && !current.loyalty_cards) {
    return json({ ok: false, code: "needs_loyalty_cards", error: "Turn Loyalty Cards on first." }, 409);
  }
  if ((MONEY_VOUCHER_KEYS as readonly string[]).includes(key) && on && !current.loyalty_cards) {
    return json({ ok: false, code: "needs_loyalty_cards", error: "Turn Loyalty Cards on first." }, 409);
  }
  patch[key] = on;

  // Update the row, insert only when there is none (MESITA-3603): an upsert's
  // INSERT half is CHECKed before ON CONFLICT, with the column defaults
  // (loyalty_cards = false), so "Prepayments needs Loyalty Cards" refused
  // every place that already had Loyalty Cards On.
  const stamp = { ...patch, updated_at: new Date().toISOString(), updated_by: user.id };
  const updated = await admin.from("place_payment_settings").update(stamp).eq("place_id", placeId).select("place_id");
  const { error } = updated.error || (updated.data?.length ?? 0) > 0
    ? updated
    : await admin.from("place_payment_settings").insert({ place_id: placeId, ...stamp });
  if (error) {
    // The SQL guards answer in their own words; say the owner's step.
    if (error.message.includes("loyalty_cards_unsigned")) {
      return json({ ok: false, code: "needs_contract", error: "Sign the Loyalty Cards Agreement first." }, 409);
    }
    if (error.message.includes("needs_stripe")) return json(NEEDS_STRIPE, 409);
    if (error.message.includes("prepay_needs_loyalty_cards") || error.message.includes("prepayments_needs_loyalty_cards")) {
      return json({ ok: false, code: "needs_loyalty_cards", error: "Turn Loyalty Cards on first." }, 409);
    }
    return json({ ok: false, error: `place_payment_settings: ${error.message}` }, 500);
  }

  return json({ ok: true, settings: await readSettings(admin, placeId) });
});
