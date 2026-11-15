import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { callCost } from "./cost.ts";

Deno.test("call cost: credits per minute weighs by length; invoice ÷ credit limit prices a credit", () => {
  const c = callCost(
    [{ cost: 600, seconds: 60 }, { cost: 1800, seconds: 120 }, { cost: 50, seconds: 0 }],
    { tier: "creator", creditLimit: 100_000, invoiceUsd: 22 },
  );
  assertEquals(c.calls, 2);
  assertAlmostEquals(c.creditsPerMinute!, 800); // 2400 credits / 3 minutes
  assertAlmostEquals(c.usdPerMinute!, 800 * 22 / 100_000);
  assertEquals(c.priceSource, "invoice");
});

Deno.test("call cost: no invoice falls back to the tier's list price; no calls is null, never 0", () => {
  const c = callCost([], { tier: "Pro", creditLimit: null, invoiceUsd: null });
  assertEquals(c.creditsPerMinute, null);
  assertEquals(c.usdPerMinute, null);
  assertAlmostEquals(c.usdPerCredit!, 99 / 500_000);
  assertEquals(c.priceSource, "list");
});
