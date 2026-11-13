import { describe, expect, it } from "vitest";
import type { PaymentAccount, PaymentSettings } from "@/lib/business-api";
import { moneyPlaceStates, ownedChip, ownedState, stripeState } from "./place-states";

// Money gating (MESITA-3588): which Place States say a guest can pay, earn
// or prepay here. Wrong here means an operator reads "On" where money
// cannot move, or "Off" where it does.

const acct = (o: Partial<PaymentAccount> = {}): PaymentAccount => ({
  state: "ready",
  livemode: false,
  country: "MX",
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  requirements_due: 0,
  ...o,
});
const settings = (o: Partial<PaymentSettings> = {}): PaymentSettings => ({
  house_credits: true,
  cash_payments: true,
  card_cashback_bps: 500,
  cash_cashback_bps: 200,
  credit_cashback_bps: null,
  prepay_cashback_bps: null,
  pay_cards: true,
  prepayments: true,
  voucher_200: true,
  voucher_1000: false,
  voucher_5000: false,
  voucher_welcome: false,
  voucher_story: false,
  voucher_vip: false,
  ...o,
});
const base = { codeSet: false, feeHold: false, feeOverdue: false, reservations: false, contract: { signed: true, signed_at: "2026-11-09T00:00:00Z", terms_version: "draft-2026-11" } };

describe("place states", () => {
  it("reads Owned's three values: an owner wins over a pending claim", () => {
    expect(ownedChip(ownedState(true, true))).toEqual({ on: true, chip: "Owned" });
    expect(ownedChip(ownedState(false, true))).toEqual({ on: false, chip: "Claim pending" });
    expect(ownedChip(ownedState(false, false))).toEqual({ on: false, chip: "Unclaimed" });
  });

  it("reads Stripe's seven values from the account", () => {
    expect(stripeState(null)).toBe("None");
    expect(stripeState(acct({ state: "none" }))).toBe("None");
    expect(stripeState(acct({ state: "restricted" }))).toBe("Restricted");
    expect(stripeState(acct({ state: "onboarding", details_submitted: false, charges_enabled: false }))).toBe("Onboarding");
    expect(stripeState(acct({ charges_enabled: false }))).toBe("In review");
    expect(stripeState(acct({ payouts_enabled: false }))).toBe("Payouts paused");
    expect(stripeState(acct({ requirements_due: 2 }))).toBe("Action needed");
    expect(stripeState(acct())).toBe("Connected");
  });

  it("turns Mesita Payments and its cashback off on an unpaid fee invoice", () => {
    const on = moneyPlaceStates({ ...base, account: acct(), settings: settings() });
    expect([on.mesitaPayments.chip, on.mesitaPaymentsCashback.chip, on.billing.chip]).toEqual(["On", "5%", "Paid up"]);
    const held = moneyPlaceStates({ ...base, feeHold: true, account: acct(), settings: settings() });
    expect([held.mesitaPayments.chip, held.mesitaPaymentsCashback.chip, held.billing.chip]).toEqual(["Off", "Off", "Past due"]);
  });

  it("gives the cash rate only with House Credits, Cash Payments and the waiter's code, no Stripe needed", () => {
    expect(moneyPlaceStates({ ...base, account: null, settings: settings() }).cashPaymentsCashback.chip).toBe("Off");
    const cash = moneyPlaceStates({ ...base, codeSet: true, account: null, settings: settings() });
    expect([cash.cashPayments.chip, cash.cashPaymentsCashback.chip, cash.mesitaPayments.chip]).toEqual(["On", "2%", "Off"]);
  });

  it("sells prepayments only with House Credits, a voucher on and Stripe taking cards", () => {
    expect(moneyPlaceStates({ ...base, account: acct(), settings: settings({ house_credits: false, voucher_200: false }) }).mesitaPrepayments.chip).toBe("Off");
    expect(moneyPlaceStates({ ...base, account: acct(), settings: settings() }).mesitaPrepayments.chip).toBe("On");
    expect(moneyPlaceStates({ ...base, account: acct({ charges_enabled: false }), settings: settings() }).mesitaPrepayments.chip).toBe("Off");
    expect(moneyPlaceStates({ ...base, account: acct(), settings: settings({ voucher_200: false }) }).mesitaPrepayments.chip).toBe("Off");
  });

  it("reads the place's own rates and House Credits (MESITA-3589)", () => {
    const m = moneyPlaceStates({ ...base, codeSet: true, account: acct(), settings: settings({ card_cashback_bps: 700, cash_cashback_bps: 300 }) });
    expect([m.mesitaPaymentsCashback.chip, m.cashPaymentsCashback.chip, m.houseCredits.chip, m.houseCreditsContract.chip]).toEqual(["7%", "3%", "On", "Signed"]);
    const off = moneyPlaceStates({ ...base, codeSet: true, account: acct(), settings: settings({ house_credits: false, voucher_200: false }) });
    expect([off.mesitaPaymentsCashback.chip, off.cashPaymentsCashback.chip, off.houseCredits.chip]).toEqual(["Off", "Off", "Off"]);
  });
});
