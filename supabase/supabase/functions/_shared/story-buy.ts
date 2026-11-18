// The Story buy's own rule (MESITA-4296, MESITA-4405): a Story is paid on
// its own, one unit. Since MESITA-4405 the Story voucher pays FIRST: the buy
// names no story and checks none (the Story record does that after the
// money lands); the guest rules (Instagram, followers, public account, one
// per visit, a mention source) stay in vouchers.ts.

import type { MoneyCode } from "./money-codes.ts";

export type StoryBuyRefusal = { status: number; code: MoneyCode | "bad_body"; error: string; field?: string };

const BASKET: StoryBuyRefusal = { status: 409, code: "story_one_per_basket", error: "The Story voucher is paid on its own" };

/** A Story basket: exactly one Story and nothing else. Null when the basket
 *  has no Story or is a Story alone. */
export function storyBasketRefusal(kinds: readonly string[], units: number): StoryBuyRefusal | null {
  if (!kinds.includes("voucher_story")) return null;
  return kinds.length === 1 && units === 1 ? null : BASKET;
}
