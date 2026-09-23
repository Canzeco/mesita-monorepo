// deno test supabase/functions/_shared/visit-tenders.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  impliedAtPlaceTenderRows,
  mesitaPayTenderRows,
  netAmountDueCents,
} from "./visit-tenders.ts";

Deno.test("netAmountDueCents matches record_visit_tenders arithmetic", () => {
  assertEquals(netAmountDueCents(1000, 300), 700);
  assertEquals(netAmountDueCents(1000, 1000), 0);
  assertEquals(netAmountDueCents(null, 0), 0);
});

Deno.test("impliedAtPlaceTenderRows: zero net yields no rows", () => {
  assertEquals(impliedAtPlaceTenderRows(0), []);
});

Deno.test("impliedAtPlaceTenderRows: one cash row for whole net", () => {
  assertEquals(impliedAtPlaceTenderRows(850), [{
    method: "cash",
    amount_cents: 850,
  }]);
});

Deno.test("mesitaPayTenderRows carries PaymentIntent id", () => {
  assertEquals(mesitaPayTenderRows(500, "pi_123"), [{
    method: "mesita_pay",
    amount_cents: 500,
    stripe_payment_intent_id: "pi_123",
  }]);
});
