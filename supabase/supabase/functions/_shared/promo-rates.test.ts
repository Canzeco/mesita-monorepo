// The one promo-rate + monthly_promo_cap validator behind the three write
// doors (business-web-update-place, admin-web-set-plan,
// business-web-set-partnership). The 400 bodies are wire contract: these
// strings are what the consoles show.
//   deno test supabase/functions/_shared/promo-rates.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { applyPromoRatesFromBody, hasPromoRatesInBody } from "./promo-rates.ts";

async function assert400(
  res: ReturnType<typeof applyPromoRatesFromBody>,
  error: string,
): Promise<void> {
  assertEquals(res.ok, false);
  if (res.ok) return;
  assertEquals(res.response.status, 400);
  assertEquals(await res.response.json(), { ok: false, error });
}

Deno.test("hasPromoRatesInBody: any rate key or the cap key, even null", () => {
  assertEquals(hasPromoRatesInBody({}), false);
  assertEquals(hasPromoRatesInBody({ placeId: "p", plan: "pro" }), false);
  assertEquals(hasPromoRatesInBody({ free_rate: null }), true);
  assertEquals(hasPromoRatesInBody({ welcome_premium_rate: 20 }), true);
  assertEquals(hasPromoRatesInBody({ monthly_promo_cap: null }), true);
});

Deno.test("applyPromoRatesFromBody: legal values copy over, null clears, absent keys stay out", () => {
  const patch: Record<string, unknown> = {};
  const res = applyPromoRatesFromBody(
    { welcome_free_rate: 20, free_rate: "10", premium_rate: null, monthly_promo_cap: "500" },
    patch,
  );
  assertEquals(res, { ok: true });
  assertEquals(patch, {
    welcome_free_rate: 20,
    free_rate: 10,
    premium_rate: null,
    monthly_promo_cap: 500,
  });

  const cleared: Record<string, unknown> = {};
  assertEquals(applyPromoRatesFromBody({ monthly_promo_cap: null }, cleared), { ok: true });
  assertEquals(cleared, { monthly_promo_cap: null });
});

Deno.test("applyPromoRatesFromBody: a rate off the tens grid is a 400", async () => {
  await assert400(
    applyPromoRatesFromBody({ free_rate: 70 }, {}),
    "free_rate must be null or one of 10, 20, 30, 40, 50",
  );
});

Deno.test("applyPromoRatesFromBody: a non-numeric rate is a 400", async () => {
  await assert400(
    applyPromoRatesFromBody({ welcome_premium_rate: "lots" }, {}),
    "welcome_premium_rate must be null or one of 10, 20, 30, 40, 50",
  );
});

Deno.test("applyPromoRatesFromBody: a cap off the ladder is a 400", async () => {
  await assert400(
    applyPromoRatesFromBody({ monthly_promo_cap: 2000 }, {}),
    "monthly_promo_cap must be null or one of 200, 500, 1000",
  );
});

Deno.test("applyPromoRatesFromBody: a non-numeric cap is a 400", async () => {
  await assert400(
    applyPromoRatesFromBody({ monthly_promo_cap: "abc" }, {}),
    "monthly_promo_cap must be null or one of 200, 500, 1000",
  );
});

Deno.test("applyPromoRatesFromBody: rates are checked before the cap", async () => {
  const patch: Record<string, unknown> = {};
  await assert400(
    applyPromoRatesFromBody({ premium_rate: 15, monthly_promo_cap: 2000 }, patch),
    "premium_rate must be null or one of 10, 20, 30, 40, 50",
  );
  assertEquals(patch, {});
});
