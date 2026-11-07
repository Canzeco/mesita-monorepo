// MESITA-3302 — money arithmetic: integer centavos, basis points, rounded
// down. Money, so pinned.

import { assertEquals } from "jsr:@std/assert@1";
import { bps, CASHBACK_BPS, MESITA_FEE_BPS_PAYMENT, MESITA_FEE_BPS_VOUCHER, VOUCHER_CATALOG, voucherBonusCents, voucherFeeCents } from "./money.ts";

Deno.test("bps rounds down to the cent", () => {
  assertEquals(bps(999_99, 500), 4999);
  assertEquals(bps(5_000_00, 3000), 150000);
  assertEquals(bps(1, 500), 0);
  assertEquals(bps(0, 500), 0);
});

Deno.test("the fee and cashback rates are 5% each", () => {
  assertEquals(MESITA_FEE_BPS_VOUCHER, 500);
  assertEquals(MESITA_FEE_BPS_PAYMENT, 500);
  assertEquals(CASHBACK_BPS, 500);
});

Deno.test("the catalog's bonuses and fees, in centavos", () => {
  assertEquals(voucherBonusCents("voucher_200"), 20_00);
  assertEquals(voucherBonusCents("voucher_1000"), 200_00);
  assertEquals(voucherBonusCents("voucher_5000"), 1_500_00);
  assertEquals(voucherBonusCents("voucher_welcome"), 30_00);
  assertEquals(voucherFeeCents("voucher_200"), 10_00);
  assertEquals(VOUCHER_CATALOG.voucher_200.available_after_sec, 3600);
  assertEquals(VOUCHER_CATALOG.voucher_welcome.available_after_sec, 0);
});
