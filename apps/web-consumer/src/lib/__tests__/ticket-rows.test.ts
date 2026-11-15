// Pins which tab, kind, sign and cashback every wallet entry and visit gets
// in Me › Tickets (MESITA-4001). Money-adjacent: a wrong sign or a dropped
// entry tells the guest their credit moved the wrong way. Time text is never
// asserted, so the time zone cannot change a result.
import { describe, expect, it } from "vitest";
import type { GuestVisit } from "@/lib/api/tab";
import type { Wallet, WalletEntry } from "@/lib/api/wallet";
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

const only = (rows: Row[]) => {
  expect(rows).toHaveLength(1);
  return rows[0]!;
};

describe("payment rows (Visits tab)", () => {
  it("credits spent read minus, with the cashback earned beside them in cents", () => {
    const r = only(
      walletRows(wallet([e("spend", -11000, { payment_id: "p1" }), e("cashback", 300, { payment_id: "p1" })])),
    );
    expect(r.type).toBe("visits");
    expect(r.kind).toBe("payment");
    expect(KIND_WORD[r.kind!]).toBe("Payment");
    expect(r.sign).toBe("−");
    expect(r.cashbackCents).toBe(300);
    expect(r.status.label).toBe("Paid");
  });

  it("cashback alone reads plus, with no separate cashback line", () => {
    const r = only(walletRows(wallet([e("cashback", 300, { payment_id: "p1" })])));
    expect(r.sign).toBe("+");
    expect(r.cashbackCents).toBeNull();
  });

  it("a cash payment with neither credits nor cashback has no sign", () => {
    const r = only(walletRows(wallet([e("reversal", -300, { payment_id: "p1" })])));
    expect(r.sign).toBeNull();
  });

  it("a cashback reversal folds into its payment, which reads Refunded", () => {
    const r = only(
      walletRows(wallet([e("cashback", 300, { payment_id: "p1" }), e("reversal", -300, { payment_id: "p1" })])),
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

  it("a paid visit is unsigned and carries its payments' cashback in cents", () => {
    const facts = new Map([
      ["p1", { currency: "MXN", credits: 0, cashback: 300, takenBack: 0, givenBack: 0 }],
    ]);
    const r = only(visitRows([visit()], facts));
    expect(r.type).toBe("visits");
    expect(r.kind).toBe("visit");
    expect(KIND_WORD[r.kind!]).toBe("Visit");
    expect(r.sign).toBeNull();
    expect(r.cashbackCents).toBe(300);
  });

  it("a visit with no payment facts has no cashback", () => {
    const r = only(visitRows([visit({ part_payment_ids: [] })], new Map()));
    expect(r.cashbackCents).toBeNull();
  });
});

describe("voucher rows (MESITA-4003)", () => {
  it("a purchase reads plus and folds its cashback into the row", () => {
    const r = only(
      walletRows(wallet([e("prepay", 50000, { purchase_id: "u1" }), e("cashback", 2500, { purchase_id: "u1" })])),
    );
    expect(r.kind).toBe("voucher");
    expect(r.sign).toBe("+");
    expect(r.cashbackCents).toBe(2500);
  });

  it("a cashback with no voucher beside it stays a row of its own", () => {
    expect(walletRows(wallet([e("cashback", 2500, { purchase_id: "u9" })]))).toHaveLength(1);
  });

  it("a bonus and a Story voucher read plus; the Story line says post", () => {
    const rows = walletRows(
      wallet([e("bonus", 5000)], {
        waiting_stories: [
          { purchase_id: "s1", place_id: "x", place: null, credit_cents: 1000, currency: "MXN", paid_at: AT },
        ],
      } as unknown as Partial<Wallet>),
    );
    expect(rows.map((r) => r.sign)).toEqual(["+", "+"]);
    expect(rows[1]!.line).toBe("Story voucher · post your Story");
  });
});

describe("every other kind lands on its tab with its kind", () => {
  const cases: Array<[string, WalletEntry, Row["type"], string]> = [
    ["a purchase", e("prepay", 50000), "vouchers", "voucher"],
    ["a bonus alone", e("bonus", 5000), "vouchers", "bonus"],
    ["a gift received", e("gift_in", 20000), "gifts-in", "gift_in"],
    ["a gift sent", e("gift_out", -20000), "gifts-out", "gift_out"],
    ["a gift taken back", e("gift_back", 20000), "gifts-out", "gift_back"],
    ["a purchase refund", e("reversal", -50000, { purchase_id: "u1" }), "refunds", "refund"],
  ];
  for (const [name, entry, tab, kind] of cases) {
    it(name, () => {
      const r = only(walletRows(wallet([entry])));
      expect(r.type).toBe(tab);
      expect(r.kind).toBe(kind);
    });
  }

  it("a Story voucher waiting and a link nobody took", () => {
    const rows = walletRows(
      wallet([], {
        waiting_stories: [
          { purchase_id: "s1", place_id: "x", place: null, credit_cents: 1000, currency: "MXN", paid_at: AT },
        ],
        sent_links: [{ gift_id: "g1", place_id: "x", amount_cents: 1000, currency: "MXN", created_at: AT }],
      } as unknown as Partial<Wallet>),
    );
    expect(rows.map((r) => [r.type, r.kind])).toEqual([
      ["vouchers", "story"],
      ["gifts-out", "gift_link"],
    ]);
  });
});
