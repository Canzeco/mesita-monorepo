// The House Card's rows (MESITA-3750): one row per purchase, the right sum,
// and never a merged bill or a refunded purchase shown as money on its way.
import { describe, expect, it } from "vitest";
import { entryLabel, type WalletEntry } from "@/lib/api/wallet";
import { groupEntries, groupKeys, splitEntries } from "@/lib/wallet-entries";
import { shouldReread } from "@/lib/wallet-countdown";

const AT = "2026-11-11T18:00:00.000Z";
const LANDS = "2026-11-11T19:00:00.000Z";
const e = (x: Partial<WalletEntry> & Pick<WalletEntry, "kind" | "amount_cents">): WalletEntry => ({
  at: AT,
  pending: false,
  available_at: null,
  payment_id: null,
  purchase_id: null,
  ...x,
});

describe("groupEntries", () => {
  it("folds a voucher's bonus into one row with the summed amount", () => {
    const rows = groupEntries([
      e({ kind: "voucher", amount_cents: 10_000, purchase_id: "p1", pending: true, available_at: LANDS }),
      e({ kind: "bonus", amount_cents: 2_000, purchase_id: "p1", pending: true, available_at: LANDS }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "voucher", amount_cents: 12_000, bonus_cents: 2_000 });
  });

  it("folds a prepay's bonus too, and a bonus listed before its purchase", () => {
    const rows = groupEntries([
      e({ kind: "bonus", amount_cents: 500, purchase_id: "p2" }),
      e({ kind: "prepay", amount_cents: 5_000, purchase_id: "p2" }),
    ]);
    expect(rows).toEqual([expect.objectContaining({ kind: "prepay", amount_cents: 5_500, bonus_cents: 500 })]);
  });

  it("joins by purchase_id even when the times differ", () => {
    const rows = groupEntries([
      e({ kind: "voucher", amount_cents: 10_000, purchase_id: "p3", at: AT }),
      e({ kind: "bonus", amount_cents: 1_000, purchase_id: "p3", at: "2026-11-11T18:00:01.000Z" }),
    ]);
    expect(rows.map((r) => r.amount_cents)).toEqual([11_000]);
  });

  it("falls back to the same at and available_at without a purchase_id", () => {
    const rows = groupEntries([
      e({ kind: "voucher", amount_cents: 10_000, pending: true, available_at: LANDS }),
      e({ kind: "bonus", amount_cents: 1_000, pending: true, available_at: LANDS }),
    ]);
    expect(rows.map((r) => r.amount_cents)).toEqual([11_000]);
  });

  it("keeps two purchases apart even with equal amounts", () => {
    const rows = groupEntries([
      e({ kind: "voucher", amount_cents: 10_000, purchase_id: "a", at: "2026-11-11T18:20:00.000Z" }),
      e({ kind: "bonus", amount_cents: 1_000, purchase_id: "a", at: "2026-11-11T18:20:00.000Z" }),
      e({ kind: "voucher", amount_cents: 10_000, purchase_id: "b", at: "2026-11-11T18:00:00.000Z" }),
      e({ kind: "bonus", amount_cents: 1_000, purchase_id: "b", at: "2026-11-11T18:00:00.000Z" }),
    ]);
    expect(rows.map((r) => [r.purchase_id, r.amount_cents])).toEqual([["a", 11_000], ["b", 11_000]]);
  });

  it("never merges a pending entry with a settled one", () => {
    const rows = groupEntries([
      e({ kind: "voucher", amount_cents: 10_000, purchase_id: "p", pending: true, available_at: LANDS }),
      e({ kind: "bonus", amount_cents: 1_000, purchase_id: "p", pending: false }),
    ]);
    expect(rows).toHaveLength(2);
  });

  it("keeps a settled spend and its cashback as two rows, and the spend's payment", () => {
    const rows = groupEntries([
      e({ kind: "spend", amount_cents: -50_000, payment_id: "pay" }),
      e({ kind: "cashback", amount_cents: 2_500, payment_id: "pay" }),
    ]);
    expect(rows.map((r) => [r.kind, r.amount_cents, r.payment_id])).toEqual([
      ["spend", -50_000, "pay"],
      ["cashback", 2_500, "pay"],
    ]);
  });

  it("keeps a bonus with no purchase as its own row, in the server's order", () => {
    const rows = groupEntries([
      e({ kind: "gift_in", amount_cents: 3_000, at: "2026-11-11T19:00:00.000Z" }),
      e({ kind: "bonus", amount_cents: 1_000, purchase_id: "nope" }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["gift_in", "bonus"]);
  });
});

describe("splitEntries", () => {
  it("lists pending rows soonest first and history newest first", () => {
    const { pending, history } = splitEntries([
      e({ kind: "voucher", amount_cents: 1, purchase_id: "late", pending: true, available_at: "2026-11-11T19:40:00.000Z", at: "2026-11-11T18:40:00.000Z" }),
      e({ kind: "voucher", amount_cents: 2, purchase_id: "soon", pending: true, available_at: "2026-11-11T19:20:00.000Z", at: "2026-11-11T18:20:00.000Z" }),
      e({ kind: "spend", amount_cents: -3, payment_id: "x", at: "2026-11-11T17:00:00.000Z" }),
      e({ kind: "cashback", amount_cents: 4, payment_id: "y", at: "2026-11-11T16:00:00.000Z" }),
    ]);
    expect(pending.map((r) => r.purchase_id)).toEqual(["soon", "late"]);
    expect(history.map((r) => r.kind)).toEqual(["spend", "cashback"]);
  });

  it("moves a purchase refunded before it landed to History, one row, not pending", () => {
    const { pending, history } = splitEntries([
      e({ kind: "reversal", amount_cents: -12_000, purchase_id: "r", at: "2026-11-11T18:30:00.000Z" }),
      e({ kind: "voucher", amount_cents: 10_000, purchase_id: "r", pending: true, available_at: LANDS }),
      e({ kind: "bonus", amount_cents: 2_000, purchase_id: "r", pending: true, available_at: LANDS }),
    ]);
    expect(pending).toEqual([]);
    expect(history.map((r) => [r.kind, r.amount_cents, r.refunded ?? false])).toEqual([
      ["reversal", -12_000, false],
      ["voucher", 12_000, true],
    ]);
  });
});

describe("groupKeys", () => {
  it("stays unique for rows that share an id", () => {
    const keys = groupKeys(groupEntries([e({ kind: "gift_in", amount_cents: 1 }), e({ kind: "gift_in", amount_cents: 2 })]));
    expect(new Set(keys).size).toBe(2);
  });
});

describe("entryLabel", () => {
  it("reads a reversal from what it carries", () => {
    expect(entryLabel({ kind: "reversal", purchase_id: "p", payment_id: null })).toBe("Purchase refunded");
    expect(entryLabel({ kind: "reversal", purchase_id: null, payment_id: "pay" })).toBe("Cashback taken back");
    expect(entryLabel({ kind: "reversal", purchase_id: null, payment_id: null })).toBe("Refund");
  });

  it("names credit given back on a payment", () => {
    expect(entryLabel({ kind: "refund", payment_id: "pay" })).toBe("Refund");
  });
});

describe("shouldReread", () => {
  it("allows three re-reads for one stuck moment and refuses the fourth", () => {
    expect([0, 1, 2, 3].map(shouldReread)).toEqual([true, true, true, false]);
  });
});
