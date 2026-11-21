// MESITA-3302 — money arithmetic: integer centavos, basis points, rounded
// down. Money, so pinned.

import { assertEquals } from "jsr:@std/assert@1";
import { bps, MESITA_FEE_BPS_PAYMENT, MESITA_FEE_BPS_VOUCHER, VOUCHER_CATALOG, voucherBonusCents, voucherFeeCents, vouchersUpToPct, voucherPriceCents, VOUCHER_PRICE_CENTS, VOUCHER_CURRENCY_LIST, toStripeAmount, fromStripeAmount, currencyForCountry, countryForCurrency } from "./money.ts";

Deno.test("bps rounds down to the cent", () => {
  assertEquals(bps(999_99, 500), 4999);
  assertEquals(bps(5_000_00, 3000), 150000);
  assertEquals(bps(1, 500), 0);
  assertEquals(bps(0, 500), 0);
});

Deno.test("the fee rates are 5% each", () => {
  assertEquals(MESITA_FEE_BPS_VOUCHER, 500);
  assertEquals(MESITA_FEE_BPS_PAYMENT, 500);
});

Deno.test("the catalog's bonuses and fees, in centavos", () => {
  // MESITA-4152: Small MX$200 / US$20 +10%; Medium MX$1,000 / US$100 +20%;
  // Big MX$5,000 / US$500 +30%.
  assertEquals(voucherPriceCents("voucher_200"), 200_00);
  assertEquals(voucherBonusCents("voucher_200"), 20_00);
  assertEquals(voucherPriceCents("voucher_1000"), 1_000_00);
  assertEquals(voucherBonusCents("voucher_1000"), 200_00);
  assertEquals(voucherPriceCents("voucher_5000"), 5_000_00);
  assertEquals(voucherBonusCents("voucher_5000"), 1_500_00);
  assertEquals(voucherBonusCents("voucher_200", "usd"), 2_00);
  assertEquals(voucherBonusCents("voucher_1000", "usd"), 20_00);
  assertEquals(voucherPriceCents("voucher_200", "usd"), 20_00);
  assertEquals(voucherPriceCents("voucher_5000", "usd"), 500_00);
  assertEquals(voucherPriceCents("voucher_1000", "usd"), 100_00);
  // MESITA-3943: three sell — MXN, USD, CAD.
  assertEquals(voucherPriceCents("voucher_200", "cad"), 20_00);
  assertEquals(voucherPriceCents("voucher_1000", "cad"), 100_00);
  assertEquals(voucherPriceCents("voucher_200", "eur"), null);
  assertEquals(voucherPriceCents("voucher_200", "jpy"), null);
  assertEquals(Object.keys(VOUCHER_PRICE_CENTS).sort(), ["cad", "mxn", "usd"]);
  // MESITA-3919: every selling currency is on the list; Small 2×, Medium 10×, Big 50× its base (MESITA-4152).
  for (const cur of Object.keys(VOUCHER_PRICE_CENTS)) {
    const row = VOUCHER_CURRENCY_LIST.find((r) => r.code === cur.toUpperCase());
    assertEquals((row?.small ?? 0) * 2, (voucherPriceCents("voucher_200", cur) ?? 0) / 100);
    assertEquals(voucherPriceCents("voucher_1000", cur), (row?.small ?? 0) * 100 * 10);
    assertEquals(voucherPriceCents("voucher_5000", cur), (row?.small ?? 0) * 100 * 50);
  }
  assertEquals(VOUCHER_CURRENCY_LIST.length, 3);
});

Deno.test("Stripe gets yen and Chilean pesos in whole units; the ledger keeps hundredths (MESITA-3923)", () => {
  assertEquals(toStripeAmount(1_000_00, "jpy"), 1000);
  assertEquals(toStripeAmount(1_000_00, "JPY"), 1000);
  assertEquals(toStripeAmount(1_100_00, "clp"), 1100);
  assertEquals(toStripeAmount(10_00, "usd"), 1000);
  assertEquals(fromStripeAmount(1000, "jpy"), 1_000_00);
  assertEquals(fromStripeAmount(1000, "usd"), 1000);
  assertEquals(currencyForCountry("ES"), "eur");
  assertEquals(currencyForCountry("jp"), "jpy");
  assertEquals(currencyForCountry("AR"), null);
  assertEquals(countryForCurrency("eur", "FR"), "FR");
  assertEquals(countryForCurrency("eur", "MX"), "ES");
  assertEquals(countryForCurrency("cad"), "CA");
  for (const r of VOUCHER_CURRENCY_LIST) assertEquals(String(r.small)[0], "1");
  assertEquals(voucherBonusCents("voucher_1000"), 200_00);
  assertEquals(voucherBonusCents("voucher_5000"), 1_500_00);
  assertEquals(voucherBonusCents("voucher_welcome"), 100_00);
  // No VIP offer (MESITA-4249).
  assertEquals("voucher_vip" in VOUCHER_CATALOG, false);
  assertEquals(voucherFeeCents("voucher_200"), 10_00);
  assertEquals(VOUCHER_CATALOG.voucher_200.available_after_sec, 10800);
  // Every voucher waits an hour except Story (MESITA-3323) and Welcome (MESITA-4198).
  assertEquals(VOUCHER_CATALOG.voucher_welcome.available_after_sec, 10800);
  assertEquals(VOUCHER_CATALOG.voucher_story.available_after_sec, 10800);
  // Story is MX$100 +30% (MESITA-4563): MX$30 bonus, MX$130 of credit.
  assertEquals(voucherPriceCents("voucher_story"), 100_00);
  assertEquals(voucherBonusCents("voucher_story"), 30_00);
});

Deno.test("the Home tile's line is the best bonus among what the place sells (MESITA-3312)", () => {
  assertEquals(vouchersUpToPct([]), null);
  assertEquals(vouchersUpToPct(["voucher_200"]), 10);
  assertEquals(vouchersUpToPct(["voucher_200", "voucher_1000"]), 20);
  assertEquals(vouchersUpToPct(["voucher_200", "voucher_5000"]), 30);
  assertEquals(vouchersUpToPct(["voucher_200", "voucher_1000", "voucher_welcome"]), 100);
});
