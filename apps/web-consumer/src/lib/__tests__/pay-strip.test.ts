// Money (MESITA-3759): what the guest's payment page says about the money,
// for every state it can be in. A wrong line here tells a guest that an
// unpaid, refunded or unsigned payment is fine.
import { describe, expect, it } from "vitest";
import { payStrip, type PayStripTab } from "@/lib/pay-strip";

const NOW = Date.parse("2026-11-11T20:00:00Z");
const LATER = "2026-11-11T22:00:00Z";
const EARLIER = "2026-11-11T19:00:00Z";

const part = (p: string, status: string, paid = false) => ({ id: `${p}-${status}`, part: p, status, paid_at: paid ? EARLIER : null });

function tab(over: Partial<PayStripTab> = {}): PayStripTab {
  return { status: "paying", expires_at: LATER, verified_at: null, cash_bill_cents: 0, cash_tip_cents: 0, parts: [], ...over };
}

const read = (over: Partial<PayStripTab> = {}) => payStrip(tab(over), NOW);

describe("a payment the waiter can still sign", () => {
  it("cash waiting: the strip at step 6, amber, the guest shows the QR", () => {
    const v = read({ cash_bill_cents: 50_000, parts: [part("outside", "open")] });
    expect(v).toMatchObject({ state: "waiting", strip: "waiting", heading: null, band: "Show this to the waiter", green: false, signed: false, closed: false });
  });

  it("a card still going through says so and is not green", () => {
    for (const status of ["open", "opening"]) {
      const v = read({ parts: [part("card", status)] });
      expect(v, status).toMatchObject({ strip: "waiting", band: "Card going through", green: false });
    }
  });

  it("a card paid with no cash is Paid and green, and still waits for the waiter", () => {
    const v = read({ status: "paid", parts: [part("card", "paid", true)] });
    expect(v).toMatchObject({ state: "waiting", strip: "waiting", heading: null, band: "Paid", green: true, signed: false });
  });

  it("a card paid with cash still owed is not green", () => {
    const v = read({ cash_tip_cents: 5_000, parts: [part("card", "paid", true), part("outside", "open")] });
    expect(v).toMatchObject({ strip: "waiting", band: "Show this to the waiter", green: false });
  });
});

describe("a signed payment", () => {
  it("all six solid, Paid · Signed, green, with or without cash, inside or past its window", () => {
    for (const over of [{}, { cash_bill_cents: 50_000 }, { expires_at: EARLIER }] as Array<Partial<PayStripTab>>) {
      const v = read({ status: "paid", verified_at: EARLIER, ...over });
      expect(v).toMatchObject({ state: "signed", strip: "signed", heading: null, band: "Paid · Signed", green: true, signed: true });
    }
  });
});

describe("a payment that ended without a signature has no strip", () => {
  it("expired with cash: Closed is the heading, never green", () => {
    for (const over of [{ status: "expired" }, { status: "paying", expires_at: EARLIER }, { status: "paid", expires_at: EARLIER }] as Array<Partial<PayStripTab>>) {
      const v = read({ cash_bill_cents: 50_000, ...over });
      expect(v).toMatchObject({ state: "closed", strip: null, heading: "Closed", band: "Closed", green: false, closed: true });
    }
  });

  it("cancelled: Closed, never green", () => {
    expect(read({ status: "cancelled" })).toMatchObject({ state: "closed", strip: null, heading: "Closed", green: false, closed: true });
  });

  it("paid in the app, no cash, window over: Paid stays green, with no strip", () => {
    const v = read({ status: "paid", expires_at: EARLIER, parts: [part("card", "paid", true)] });
    expect(v).toMatchObject({ state: "closed", strip: null, heading: "Paid", band: "Paid", green: true, signed: false });
  });
});

describe("money that went back or is being checked", () => {
  it("refunded is never green and never shows the strip, even after a signature", () => {
    for (const verified_at of [null, EARLIER]) {
      const v = read({ status: "paid", verified_at, parts: [part("card", "refunded", true)] });
      expect(v).toMatchObject({ state: "refunded", strip: null, heading: "Refunded", band: "Refunded", green: false });
    }
  });

  it("partly refunded says so", () => {
    const v = read({ status: "paid", verified_at: EARLIER, parts: [part("card", "partly_refunded", true)] });
    expect(v).toMatchObject({ state: "refunded", strip: null, heading: "Partly refunded", green: false });
  });

  it("needs review wins over everything: no strip, no green", () => {
    const v = read({ status: "paid", verified_at: EARLIER, parts: [part("card", "needs_review"), part("card", "refunded")] });
    expect(v).toMatchObject({ state: "review", strip: null, heading: "We're checking this payment.", green: false });
  });
});
