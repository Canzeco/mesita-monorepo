// MESITA-4296, MESITA-4405: the Story buy's one rule, without a database.
import { assertEquals } from "jsr:@std/assert@1";
import { storyBasketRefusal } from "./story-buy.ts";

Deno.test("storyBasketRefusal: a Story is paid alone, one unit", () => {
  assertEquals(storyBasketRefusal(["voucher_story"], 1), null);
  assertEquals(storyBasketRefusal(["voucher_200"], 3), null, "no Story, no rule");
  assertEquals(storyBasketRefusal(["voucher_story"], 2)?.code, "story_one_per_basket");
  assertEquals(storyBasketRefusal(["voucher_story", "voucher_200"], 2)?.code, "story_one_per_basket");
});
