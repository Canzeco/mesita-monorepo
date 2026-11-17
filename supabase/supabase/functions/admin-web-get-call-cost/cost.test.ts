import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { callCost, listPrice, parseMxnPerUsd } from "./cost.ts";

Deno.test("call cost: a suffixed tier still finds its list price; an unknown one is null", () => {
  assertEquals(listPrice("creator_2024"), { usd: 22, credits: 100_000 });
  assertEquals(listPrice("Pro"), { usd: 99, credits: 500_000 });
  assertEquals(listPrice("free"), null);
  assertEquals(listPrice(null), null);
});

Deno.test("call cost: the peso rate is a positive number or null, never 0", () => {
  assertEquals(parseMxnPerUsd({ rates: { MXN: 18.4 } }), 18.4);
  assertEquals(parseMxnPerUsd({ rates: { MXN: 0 } }), null);
  assertEquals(parseMxnPerUsd({ rates: {} }), null);
  assertEquals(parseMxnPerUsd(null), null);
});

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
