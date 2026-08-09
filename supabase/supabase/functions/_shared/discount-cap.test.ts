import { assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_DISCOUNT_CAP_MXN,
  resolveBillCapPesos,
  snapDiscountCap,
} from "./discount-cap.ts";

Deno.test("snapDiscountCap: nearest of 200 / 500 / 1000", () => {
  assertEquals(snapDiscountCap(200), 200);
  assertEquals(snapDiscountCap(500), 500);
  assertEquals(snapDiscountCap(1000), 1000);
  assertEquals(snapDiscountCap(100), 200);
  assertEquals(snapDiscountCap(350), 200);
  assertEquals(snapDiscountCap(351), 500);
  assertEquals(snapDiscountCap(2000), 1000);
  assertEquals(snapDiscountCap(null), DEFAULT_DISCOUNT_CAP_MXN);
});

Deno.test("resolveBillCapPesos: place wins over platform fallback", () => {
  assertEquals(resolveBillCapPesos({ monthly_promo_cap: 200 }, 500), 200);
  assertEquals(resolveBillCapPesos({ monthly_promo_cap: 1000 }, 200), 1000);
  assertEquals(resolveBillCapPesos({ monthly_promo_cap: null }, 1000), 1000);
  assertEquals(resolveBillCapPesos({}, null), DEFAULT_DISCOUNT_CAP_MXN);
});
