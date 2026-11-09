// MESITA-3463 — a visit is a paid payment with a card part; Story and VIP
// sell one each new visit.

import { assertEquals } from "jsr:@std/assert@1";
import { isVisit, perVisitSpent } from "./visits.ts";

Deno.test("a visit is a paid row with a card part; credit-only, outside-only and unpaid rows are not", () => {
  assertEquals(isVisit({ status: "paid", card_cents: 1 }), true);
  // A refund never takes a visit back.
  for (const status of ["partly_refunded", "refunded", "needs_review"]) assertEquals(isVisit({ status, card_cents: 5000 }), true);
  assertEquals(isVisit({ status: "paid", card_cents: 0 }), false);
  for (const status of ["opening", "open", "failed", "expired"]) assertEquals(isVisit({ status, card_cents: 5000 }), false);
});

Deno.test("one each new visit: the first before any visit, each next one after one more", () => {
  assertEquals(perVisitSpent(0, 0), false);
  assertEquals(perVisitSpent(1, 0), true);
  assertEquals(perVisitSpent(1, 1), false);
  assertEquals(perVisitSpent(2, 1), true);
});
