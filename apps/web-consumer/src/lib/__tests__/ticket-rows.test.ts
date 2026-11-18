// Pins which tab, kind and sign every wallet entry and visit gets
// in Me › Tickets (MESITA-4001). Money-adjacent: a wrong sign or a dropped
// entry tells the guest their credit moved the wrong way. Time text is never
// asserted, so the time zone cannot change a result.
import { describe, expect, it } from "vitest";
import type { GuestVisit } from "@/lib/api/tab";
import { money, type WaitingStory, type Wallet, type WalletEntry } from "@/lib/api/wallet";
import { KIND_WORD, visitRows, walletRows, type Row } from "@/lib/ticket-rows";

const AT = "2026-11-14T12:00:00.000Z";
const e = (kind: string, amount_cents: number, extra: Partial<WalletEntry> = {}): WalletEntry => ({
  kind,
  amount_cents,
  at: AT,
  pending: false,
  ...extra,
});

function wallet(entries: WalletEntry[], extra: Partial<Wallet> = {}): Wallet {
  return {
    balances: [
      {
        place_id: "11111111-1111-4111-8111-111111111111",
        place: { id: "11111111-1111-4111-8111-111111111111", slug: null, name: "Orinoco", photo: null },
        currency: "MXN",
        entries,
      },
    ],
    ...extra,
  } as unknown as Wallet;
}

const story = (over: Partial<WaitingStory> = {}): WaitingStory => ({
  purchase_id: "s1",
  story_id: "st1",
  place_id: "x",
  place: null,
  amount_cents: 10000,
  bonus_cents: 5000,
  credit_cents: 15000,
  currency: "MXN",
  paid_at: AT,
  state: "waiting",
  claimed_at: AT,
  bonus_at: null,
  recheck_at: null,
  bonus: null,
  bonus_void_reason: null,
  bonus_decided_at: null,
  refunded: false,
  time_zone: "America/Mexico_City",
  mention: null,
  test_mode: true,
  emulator: false,
  ...over,
});

const only = (rows: Row[]) => {
  expect(rows).toHaveLength(1);
  return rows[0]!;
};

describe("payment rows (Visits tab)", () => {
  it("credits spent read minus, with legacy extra credit beside them", () => {
    const r = only(
      walletRows(wallet([e("spend", -11000, { payment_id: "p1" }), e("extra", 300, { payment_id: "p1" })])),
    );
    expect(r.type).toBe("visits");
    expect(r.kind).toBe("payment");
    expect(KIND_WORD[r.kind!]).toBe("Payment");
    expect(r.sign).toBe("−");
    expect(r.status.label).toBe("Paid");
  });

  it("legacy extra credit alone reads plus", () => {
    const r = only(walletRows(wallet([e("extra", 300, { payment_id: "p1" })])));
    expect(r.sign).toBe("+");
  });

  it("a cash payment with neither credits nor extra credit has no sign", () => {
    const r = only(walletRows(wallet([e("reversal", -300, { payment_id: "p1" })])));
    expect(r.sign).toBeNull();
  });

  it("an extra-credit reversal folds into its payment, which reads Refunded", () => {
    const r = only(
      walletRows(wallet([e("extra", 300, { payment_id: "p1" }), e("reversal", -300, { payment_id: "p1" })])),
    );
    expect(r.type).toBe("visits");
    expect(r.status.label).toBe("Refunded");
    expect(r.payFacts?.takenBack).toBe(300);
  });

  it("credit given back folds into its payment instead of being dropped", () => {
    const r = only(
      walletRows(wallet([e("spend", -5000, { payment_id: "p1" }), e("refund", 5000, { payment_id: "p1" })])),
    );
    expect(r.kind).toBe("payment");
    expect(r.payFacts?.givenBack).toBe(5000);
    expect(r.status.label).toBe("Refunded");
  });
});

describe("visit rows", () => {
  const visit = (over: Partial<GuestVisit> = {}): GuestVisit => ({
    tab_id: "22222222-2222-4222-8222-222222222222",
    place: { id: "p", name: "Orinoco", slug: null, photo_url: null },
    status: "paid",
    currency: "MXN",
    bill_cents: 10000,
    tip_cents: 1000,
    ticket: null,
    waiter_name: "Ana",
    created_at: AT,
    paid_at: AT,
    expires_at: AT,
    part_payment_ids: ["p1"],
    origin: "waiter",
    ...over,
  });

  it("a paid visit is unsigned", () => {
    const facts = new Map([
      ["p1", { currency: "MXN", credits: 0, extra: 300, takenBack: 0, givenBack: 0 }],
    ]);
    const r = only(visitRows([visit()], facts));
    expect(r.type).toBe("visits");
    expect(r.kind).toBe("visit");
    expect(KIND_WORD[r.kind!]).toBe("Visit");
    expect(r.sign).toBeNull();
  });
});

describe("voucher rows (MESITA-4003)", () => {
  it("a purchase reads plus and folds its legacy extra credit into the row", () => {
    const r = only(
      walletRows(wallet([e("prepay", 50000, { purchase_id: "u1" }), e("extra", 2500, { purchase_id: "u1" })])),
    );
    expect(r.kind).toBe("voucher");
    expect(r.sign).toBe("+");
  });

  it("an extra credit with no voucher beside it stays a row of its own", () => {
    expect(walletRows(wallet([e("extra", 2500, { purchase_id: "u9" })]))).toHaveLength(1);
  });

  it("a bonus and a Story voucher read plus; the Story row is its bonus, not what was paid", () => {
    const rows = walletRows(
      wallet([e("bonus", 5000)], { waiting_stories: [story()] } as unknown as Partial<Wallet>),
    );
    expect(rows.map((r) => r.sign)).toEqual(["+", "+"]);
    // MESITA-4264: the MX$100 paid is already a voucher row; only the bonus waits (MESITA-4296: 3 h after payment).
    expect(rows[1]!.big).toBe(money(5000, "MXN"));
    expect(rows[1]!.status.label).toBe("Waiting");
  });

  it("a released Story bonus is not drawn twice; a voided one reads Not added", () => {
    const rows = walletRows(
      wallet([], {
        waiting_stories: [story({ purchase_id: "s1", state: "released", bonus: "released" }), story({ purchase_id: "s2", state: "void", bonus: "void", bonus_void_reason: "unreachable" })],
      } as unknown as Partial<Wallet>),
    );
    expect(rows.map((r) => [r.key, r.status.label])).toEqual([["s-s2", "Not added"]]);
  });
});

describe("every other kind lands on its tab with its kind", () => {
  const cases: Array<[string, WalletEntry, Row["type"], string]> = [
    ["a purchase", e("prepay", 50000), "vouchers", "voucher"],
    ["a bonus alone", e("bonus", 5000), "vouchers", "bonus"],
    ["a purchase refund", e("reversal", -50000, { purchase_id: "u1" }), "refunds", "refund"],
  ];
  for (const [name, entry, tab, kind] of cases) {
    it(name, () => {
      const r = only(walletRows(wallet([entry])));
      expect(r.type).toBe(tab);
      expect(r.kind).toBe(kind);
    });
  }

  it("a purchase refund is one row per purchase: Back to your card, no sign", () => {
    const rows = walletRows(
      wallet([
        e("prepay", 50000, { purchase_id: "u1" }),
        e("extra", 2500, { purchase_id: "u1" }),
        e("reversal", -30000, { purchase_id: "u1" }),
        e("reversal", -20000, { purchase_id: "u1" }),
      ]),
    ).filter((r) => r.type === "refunds");
    expect(rows).toHaveLength(1);
    expect([rows[0]!.line, rows[0]!.sign]).toEqual(["Back to your card", undefined]);
    expect(rows[0]!.big).toBe(money(50000, "MXN"));
  });

  it("a gift is never a ticket row: Tickets' Gifts list draws it (MESITA-4036)", () => {
    const rows = walletRows(
      wallet([e("gift_in", 20000), e("gift_out", -20000), e("gift_back", 20000)], {
        sent_links: [{ gift_id: "g1", place_id: "x", amount_cents: 1000, currency: "MXN", created_at: AT }],
      } as unknown as Partial<Wallet>),
    );
    expect(rows.filter((r) => String(r.kind).startsWith("gift"))).toEqual([]);
  });

  it("a Story voucher waiting; a link nobody took is not a row", () => {
    const rows = walletRows(
      wallet([], {
        waiting_stories: [story()],
        sent_links: [{ gift_id: "g1", place_id: "x", amount_cents: 1000, currency: "MXN", created_at: AT }],
      } as unknown as Partial<Wallet>),
    );
    expect(rows.map((r) => [r.type, r.kind])).toEqual([["vouchers", "story"]]);
  });
});
