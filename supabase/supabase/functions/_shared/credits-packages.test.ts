// isCreditPackageAmount is the WHOLE enforcement of "the client never sends
// money terms" for paidCents (MESITA-1676): consumer-web-buy-credits rejects
// any value that fails this check before it ever reaches Stripe or a
// controls_config read, so an inflated or negative paidCents never becomes a
// charge — it is simply never one of the offered packages.

import { assertEquals } from "jsr:@std/assert@1";
import { CREDIT_PACKAGE_CENTS, isCreditPackageAmount } from "./credits-packages.ts";

Deno.test("every offered package amount is accepted", () => {
  for (const cents of CREDIT_PACKAGE_CENTS) {
    assertEquals(isCreditPackageAmount(cents), true);
  }
});

Deno.test("an inflated amount (one cent over the top package) is rejected", () => {
  const top = Math.max(...CREDIT_PACKAGE_CENTS);
  assertEquals(isCreditPackageAmount(top + 1), false);
});

Deno.test("a negative amount is rejected", () => {
  assertEquals(isCreditPackageAmount(-CREDIT_PACKAGE_CENTS[0]), false);
});

Deno.test("zero is rejected", () => {
  assertEquals(isCreditPackageAmount(0), false);
});

Deno.test("a non-numeric value is rejected", () => {
  assertEquals(isCreditPackageAmount("50000"), false);
  assertEquals(isCreditPackageAmount(null), false);
  assertEquals(isCreditPackageAmount(undefined), false);
});

Deno.test("an amount between two real packages is rejected — no free-text top-up", () => {
  const sorted = [...CREDIT_PACKAGE_CENTS].sort((a, b) => a - b);
  const between = Math.round((sorted[0] + sorted[1]) / 2);
  assertEquals(isCreditPackageAmount(between), false);
});
