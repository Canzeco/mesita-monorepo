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
  // MESITA-3914: Small is MX$100 +10%, US$10 +10%; Big MX$1,000 / US$100 +20%.
  assertEquals(voucherBonusCents("voucher_200"), 10_00);
  assertEquals(voucherBonusCents("voucher_200", "usd"), 1_00);
  assertEquals(voucherBonusCents("voucher_1000", "usd"), 20_00);
  assertEquals(voucherPriceCents("voucher_200", "usd"), 10_00);
  assertEquals(voucherPriceCents("voucher_1000", "usd"), 100_00);
  // MESITA-3923: all ten sell; ¥1,000 is 100000 in the ledger's hundredths.
  assertEquals(voucherPriceCents("voucher_200", "eur"), 10_00);
  assertEquals(voucherPriceCents("voucher_200", "jpy"), 1_000_00);
  assertEquals(voucherPriceCents("voucher_1000", "cop"), 100_000_00);
  assertEquals(voucherPriceCents("voucher_200", "xxx"), null);
  assertEquals(Object.keys(VOUCHER_PRICE_CENTS).length, 10);
  // MESITA-3919: every selling currency is on the ten-currency list at the same Small, Big = 10×.
  for (const cur of Object.keys(VOUCHER_PRICE_CENTS)) {
    const row = VOUCHER_CURRENCY_LIST.find((r) => r.code === cur.toUpperCase());
    assertEquals(row?.small, (voucherPriceCents("voucher_200", cur) ?? 0) / 100);
    assertEquals(voucherPriceCents("voucher_1000", cur), (voucherPriceCents("voucher_200", cur) ?? 0) * 10);
  }
  assertEquals(VOUCHER_CURRENCY_LIST.length, 10);
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
  // Welcome and VIP are MX$100 +100% (MESITA-3835): MX$100 bonus.
  assertEquals(voucherBonusCents("voucher_vip"), 100_00);
  assertEquals(VOUCHER_CATALOG.voucher_vip.price_cents, 100_00);
  assertEquals(voucherFeeCents("voucher_200"), 5_00);
  assertEquals(VOUCHER_CATALOG.voucher_200.available_after_sec, 3600);
  // Every voucher waits an hour except Story (MESITA-3323).
  assertEquals(VOUCHER_CATALOG.voucher_welcome.available_after_sec, 3600);
  assertEquals(VOUCHER_CATALOG.voucher_vip.available_after_sec, 3600);
  assertEquals(VOUCHER_CATALOG.voucher_story.available_after_sec, 0);
});

Deno.test("the Home tile's line is the best bonus among what the place sells (MESITA-3312)", () => {
  assertEquals(vouchersUpToPct([]), null);
  assertEquals(vouchersUpToPct(["voucher_200"]), 10);
  assertEquals(vouchersUpToPct(["voucher_200", "voucher_1000"]), 20);
  assertEquals(vouchersUpToPct(["voucher_200", "voucher_1000", "voucher_welcome"]), 100);
});
