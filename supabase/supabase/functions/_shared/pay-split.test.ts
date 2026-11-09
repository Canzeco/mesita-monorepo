// MESITA-3457 — the Pay tab's split (money rule): what the form sends must
// be what consumer-web-start-payment accepts (card + tip at or above the
// minimum, never a tip without a card part).

import { assertEquals } from "jsr:@std/assert@1";
import { cashbackFor, MIN_CARD_PART_CENTS, paySplit } from "./pay-split.ts";
import { MIN_CHARGE_CENTS } from "./money.ts";

const MIN = MIN_CHARGE_CENTS.mxn;
const split = (amountCents: number, tipCents: number, availableCents: number, cardOk = true) =>
  paySplit({ amountCents, tipCents, availableCents, cardOk, minCents: MIN });

Deno.test("credit covers it all: no card", () => {
  assertEquals(split(300_00, 0, 500_00), { kind: "credit", credit_cents: 300_00, card_cents: 0, tip_cents: 0 });
});

Deno.test("past the credit: the rest by card", () => {
  assertEquals(split(300_00, 0, 250_00), { kind: "card", credit_cents: 250_00, card_cents: 50_00, tip_cents: 0, raised: false });
});

Deno.test("card part exactly at the minimum is not raised", () => {
  assertEquals(split(300_00, 0, 300_00 - MIN), { kind: "card", credit_cents: 300_00 - MIN, card_cents: MIN, tip_cents: 0, raised: false });
});

Deno.test("card part under the minimum: less credit so the card reaches it", () => {
  const s = split(300_00, 0, 299_00);
  assertEquals(s, { kind: "card", credit_cents: 300_00 - MIN, card_cents: MIN, tip_cents: 0, raised: true });
});

Deno.test("card + tip together reach the minimum: nothing raised", () => {
  assertEquals(split(300_00, MIN - 1_00, 299_00), { kind: "card", credit_cents: 299_00, card_cents: 1_00, tip_cents: MIN - 1_00, raised: false });
});

Deno.test("tip only, exactly at the minimum: the smallest card part rides with it", () => {
  const s = split(300_00, MIN, 500_00);
  assertEquals(s, { kind: "card", credit_cents: 300_00 - MIN_CARD_PART_CENTS, card_cents: MIN_CARD_PART_CENTS, tip_cents: MIN, raised: false });
  if (s.kind === "card") assertEquals(s.card_cents + s.tip_cents >= MIN, true);
});

Deno.test("tip under the minimum with credit covering: card part makes up the rest", () => {
  const s = split(300_00, 3_00, 500_00);
  assertEquals(s, { kind: "card", credit_cents: 300_00 - (MIN - 3_00), card_cents: MIN - 3_00, tip_cents: 3_00, raised: true });
});

Deno.test("whole amount under the minimum and credit can't cover: below_minimum", () => {
  assertEquals(split(5_00, 0, 2_00), { kind: "below_minimum", minimum_cents: MIN });
  assertEquals(split(5_00, 0, 0), { kind: "below_minimum", minimum_cents: MIN });
});

Deno.test("small amount the credit covers is fine", () => {
  assertEquals(split(5_00, 0, 5_00).kind, "credit");
});

Deno.test("cards off: over the credit and any tip are refused", () => {
  assertEquals(split(300_00, 0, 250_00, false), { kind: "over", credit_cents: 250_00, short_cents: 50_00 });
  assertEquals(split(100_00, 10_00, 250_00, false), { kind: "no_card_tip" });
  assertEquals(split(100_00, 0, 250_00, false).kind, "credit");
});

Deno.test("cashback is the card part's share, rounded down; never the tip", () => {
  assertEquals(cashbackFor(80_00, 500), 4_00);
  assertEquals(cashbackFor(99, 500), 4);
  assertEquals(cashbackFor(80_00, 0), 0);
});
