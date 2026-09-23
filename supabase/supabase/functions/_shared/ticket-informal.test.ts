// Unit tests for the pure promo helper in ticket-informal (MESITA-142).
//   deno test supabase/functions/_shared/ticket-informal.test.ts
//
// finalizeInformalTicket/closeTicketAndEnqueueReview take a live
// SupabaseClient and belong to integration coverage; here we lock the pure
// money helper that the discount math depends on.

import { assertEquals } from "jsr:@std/assert@1";
import { promoEligibleSubtotalCents } from "./ticket-informal.ts";

Deno.test("promoEligibleSubtotalCents: no cap -> whole subtotal is eligible", () => {
  assertEquals(promoEligibleSubtotalCents(85000, null), 85000);
  assertEquals(promoEligibleSubtotalCents(85000, undefined), 85000);
  assertEquals(promoEligibleSubtotalCents(85000, 0), 85000); // 0 = "no cap"
});

Deno.test("promoEligibleSubtotalCents: cap in pesos limits eligible cents", () => {
  // capPesos 500 -> 50000¢ ceiling.
  assertEquals(promoEligibleSubtotalCents(120000, 500), 50000);
  assertEquals(promoEligibleSubtotalCents(40000, 500), 40000); // under the cap
});
