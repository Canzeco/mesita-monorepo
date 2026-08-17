// Unit tests for the ticket money math (MESITA-142 · MESITA-1087). Pure, no
// network/DB.
//   deno test supabase/functions/_shared/business-ticket-billing.test.ts
//
// This is the computation that decides how much a guest's bill is discounted
// AND what the waiter is tipped. Amounts are in cents. The invariants, from
// plan §11 C4 — getting any of these wrong takes money from a waiter:
//   1 tip is computed on the RAW subtotal (never eligible, never amount-due)
//   2 tip ROUNDS to whole pesos; the discount FLOORS — both against Mesita
//   3 only tip_pct (or a server-derived carry) enters; client cents never do
//   4 the discount base excludes the tip; the clamp binds to subtotal
//   5 total_cents = subtotal + tip
//   6 amount_due = subtotal − discount + tip, from ONE exported formula
//   7 a reprice carries the tip forward byte-identically
//   8 amount_due ≥ tip, always — nothing may ever eat the tip

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  amountDueCents,
  computeTicketBill,
  tipCentsFor,
} from "./business-ticket-billing.ts";

// ── The pre-tip contract, unchanged (regression proof for MESITA-1087's
//    "every existing caller's output is byte-identical" claim). ────────────

Deno.test("computeTicketBill: rejects a zero subtotal", () => {
  const res = computeTicketBill({ subtotal: 0, ratePercent: 10, capPesos: null });
  assert(!res.ok);
});

Deno.test("computeTicketBill: 10% off a $850 (85000¢) bill, no cap, no tip", () => {
  const res = computeTicketBill({ subtotal: 85000, ratePercent: 10, capPesos: null });
  assert(res.ok);
  const s = res.snapshot;
  assertEquals(s.checkSubtotalCents, 85000);
  assertEquals(s.tipCents, 0);
  assertEquals(s.totalCents, 85000);
  assertEquals(s.discountPercent, 10);
  assertEquals(s.eligibleCents, 85000);
  assertEquals(s.discountCents, 8500);
  assertEquals(s.amountDueCents, 76500);
});

Deno.test("computeTicketBill: floors fractional discount cents (never over-discounts)", () => {
  // 12345¢ * 7% = 864.15¢ -> floor 864.
  const res = computeTicketBill({ subtotal: 12345, ratePercent: 7, capPesos: null });
  assert(res.ok);
  assertEquals(res.snapshot.discountCents, 864);
  assertEquals(res.snapshot.amountDueCents, 12345 - 864);
});

Deno.test("computeTicketBill: monthly cap limits the eligible subtotal", () => {
  const res = computeTicketBill({ subtotal: 120000, ratePercent: 20, capPesos: 500 });
  assert(res.ok);
  assertEquals(res.snapshot.eligibleCents, 50000);
  assertEquals(res.snapshot.discountCents, 10000);
  assertEquals(res.snapshot.amountDueCents, 110000);
});

Deno.test("computeTicketBill: cap above subtotal leaves the whole subtotal eligible", () => {
  const res = computeTicketBill({ subtotal: 30000, ratePercent: 10, capPesos: 500 });
  assert(res.ok);
  assertEquals(res.snapshot.eligibleCents, 30000);
  assertEquals(res.snapshot.discountCents, 3000);
});

Deno.test("computeTicketBill: 0% rate yields no discount, full amount due", () => {
  const res = computeTicketBill({ subtotal: 50000, ratePercent: 0, capPesos: null });
  assert(res.ok);
  assertEquals(res.snapshot.discountCents, 0);
  assertEquals(res.snapshot.amountDueCents, 50000);
});

Deno.test("computeTicketBill: discount can never exceed the subtotal (amountDue ≥ 0)", () => {
  const res = computeTicketBill({ subtotal: 10000, ratePercent: 150, capPesos: null });
  assert(res.ok);
  assert(res.snapshot.discountCents <= res.snapshot.checkSubtotalCents);
  assert(res.snapshot.amountDueCents >= 0);
  assertEquals(res.snapshot.discountCents, 10000);
  assertEquals(res.snapshot.amountDueCents, 0);
});

// ── C4 — the eight tip invariants. Canonical worked example (F3): MX$850
//    bill, 15% tip, 20% rate, MX$500 cap. ─────────────────────────────────

Deno.test("C4-1: tip is computed on the raw subtotal, never the capped eligible", () => {
  const res = computeTicketBill({
    subtotal: 85000,
    ratePercent: 20,
    capPesos: 500,
    tipPct: 15,
  });
  assert(res.ok);
  const s = res.snapshot;
  // 15% of the FULL 85000, not of the 50000 the cap left eligible.
  assertEquals(s.tipCents, 12800);
  assertEquals(s.eligibleCents, 50000);
  assertEquals(s.discountCents, 10000);
});

Deno.test("C4-2: tip ROUNDS to whole pesos (a floor refactor goes red here)", () => {
  // 33333¢ × 15% = 4999.95¢ → 50.00 pesos (floor would give 49).
  assertEquals(tipCentsFor(33333, 15), 5000);
  // 33334¢ × 15% = 5000.1¢ → 50 pesos.
  assertEquals(tipCentsFor(33334, 15), 5000);
  // 33000¢ × 15% = 4950¢ = 49.5 pesos → rounds UP to 50 (floor: 49).
  assertEquals(tipCentsFor(33000, 15), 5000);
});

Deno.test("C4-3: tipPct wins over a carried tip, and carry is clamped to ≥ 0", () => {
  const pct = computeTicketBill({
    subtotal: 85000,
    ratePercent: 10,
    capPesos: null,
    tipPct: 15,
    carryTipCents: 99999, // ignored: the preset recomputes on the subtotal
  });
  assert(pct.ok);
  assertEquals(pct.snapshot.tipCents, 12800);

  const carry = computeTicketBill({
    subtotal: 85000,
    ratePercent: 10,
    capPesos: null,
    carryTipCents: -500, // hostile carry never goes negative
  });
  assert(carry.ok);
  assertEquals(carry.snapshot.tipCents, 0);
});

Deno.test("C4-4: the discount base excludes the tip; the clamp binds to subtotal", () => {
  const res = computeTicketBill({
    subtotal: 10000,
    ratePercent: 150,
    capPesos: null,
    tipPct: 20,
  });
  assert(res.ok);
  // Discount clamps at the SUBTOTAL (10000), not at subtotal+tip (12000).
  assertEquals(res.snapshot.discountCents, 10000);
  // C4-8: even fully discounted, the tip survives in full.
  assertEquals(res.snapshot.amountDueCents, 2000);
});

Deno.test("C4-5/6: the F3 canonical bill — MX$850, 15% tip, 20% rate, MX$500 cap", () => {
  const res = computeTicketBill({
    subtotal: 85000,
    ratePercent: 20,
    capPesos: 500,
    tipPct: 15,
  });
  assert(res.ok);
  const s = res.snapshot;
  assertEquals(s.checkSubtotalCents, 85000);
  assertEquals(s.tipCents, 12800);
  assertEquals(s.totalCents, 97800); // C4-5: subtotal + tip
  assertEquals(s.discountCents, 10000);
  assertEquals(s.amountDueCents, 87800); // C4-6: 85000 − 10000 + 12800
  // The exported formula IS the snapshot's number — one source, no drift.
  assertEquals(
    amountDueCents({
      checkSubtotalCents: s.checkSubtotalCents,
      discountCents: s.discountCents,
      tipCents: s.tipCents,
    }),
    s.amountDueCents,
  );
});

Deno.test("C4-7: a reprice carries the tip forward byte-identically", () => {
  // The bill lands at 10% with a 15% tip…
  const first = computeTicketBill({
    subtotal: 85000,
    ratePercent: 10,
    capPesos: 500,
    tipPct: 15,
  });
  assert(first.ok);
  // …then a bonus lands and the reprice re-runs at 20%, carrying the row's
  // tip_cents (the reprice never knows the preset — only the stored cents).
  const repriced = computeTicketBill({
    subtotal: 85000,
    ratePercent: 20,
    capPesos: 500,
    carryTipCents: first.snapshot.tipCents,
  });
  assert(repriced.ok);
  assertEquals(repriced.snapshot.tipCents, first.snapshot.tipCents);
  assertEquals(repriced.snapshot.totalCents, 97800);
  assertEquals(repriced.snapshot.amountDueCents, 87800);
});

Deno.test("C4-8: amount due is never less than the tip", () => {
  for (const tipPct of [0, 10, 15, 20, 100]) {
    for (const rate of [0, 10, 100, 150]) {
      const res = computeTicketBill({
        subtotal: 33333,
        ratePercent: rate,
        capPesos: 200,
        tipPct,
      });
      assert(res.ok);
      assert(
        res.snapshot.amountDueCents >= res.snapshot.tipCents,
        `due ${res.snapshot.amountDueCents} < tip ${res.snapshot.tipCents} at rate ${rate} tip ${tipPct}`,
      );
    }
  }
});

Deno.test("tipCentsFor: clamps hostile percents into 0–100", () => {
  assertEquals(tipCentsFor(85000, -5), 0);
  assertEquals(tipCentsFor(85000, 250), 85000);
  assertEquals(tipCentsFor(85000, 0), 0);
});
