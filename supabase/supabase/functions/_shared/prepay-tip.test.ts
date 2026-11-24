// Money (MESITA-4878): the saving a receipt states.
import { assertEquals } from "jsr:@std/assert@1";
import { prepayTip } from "./prepay-tip.ts";

const S = { voucher: "voucher_200", price_cents: 20_000, credit_cents: 22_000 };
const M = { voucher: "voucher_1000", price_cents: 100_000, credit_cents: 120_000 };
const B = { voucher: "voucher_5000", price_cents: 500_000, credit_cents: 700_000 };

Deno.test("the smallest voucher that covers the part paid outside", () => {
  assertEquals(prepayTip(22_000, 0, [B, S, M])?.voucher, "voucher_200");
  assertEquals(prepayTip(60_000, 0, [B, S, M]), { ...M, saving_cents: 10_000 });
});
Deno.test("the biggest covers a part of a bigger bill", () => {
  assertEquals(prepayTip(1_000_000, 0, [S, M, B]), { ...B, saving_cents: 200_000 });
});
Deno.test("the cashback that part earned comes off; never a loss", () => {
  assertEquals(prepayTip(60_000, 3_000, [M])?.saving_cents, 7_000);
  assertEquals(prepayTip(60_000, 12_000, [M]), null);
});
Deno.test("nothing outside or nothing on sale: no tip", () => {
  assertEquals(prepayTip(0, 0, [S]), null);
  assertEquals(prepayTip(5_000, 0, []), null);
});
