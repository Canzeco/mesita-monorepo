// A STORY VOUCHER IS ONE VOUCHER (Pato, 2026-11-21, MESITA-4627: "since the
// voucher is going to be story automatically, you don't need to create a
// story ticket … ONLY VOUCHERS AND VISITS AND GIFTS. THE STORY THING IS JUST
// ONE EXTRA STEP"). Its steps:
//
//   classic voucher   1 Pay · 2 Credits · 3 Wait 3 hours · 4 Bonus
//   Story voucher     1 Pay · 2 Credits · 3 Post Story · 4 Wait 3 hours ·
//                     5 Check Story · 6 Bonus
//
// Paying a Story voucher creates no Story record (MESITA-4484): the wallet
// read's `story_purchase_ids` says which purchases are Story vouchers, and the
// Story record (when one exists) says how far it got.
//
//   no Story · waiting_post · found · void on a paid purchase ─► post
//   approved, bonus_at ahead                                   ─► wait
//   approved, bonus_at passed (the server rechecks the story)  ─► check
//   released                                                   ─► done
//   the purchase refunded                                      ─► lost
//
// A PLAIN MODULE: no React (ticket-rows.ts and its tests read it).

import type { StoryTicket, Wallet } from "@/lib/api/wallet";

export type StoryVoucherStage = "post" | "wait" | "check" | "done" | "lost";

const OPEN = new Set(["waiting_post", "found", "approved"]);

/** Every purchase that is a Story voucher: the server's list, plus any
 *  purchase a Story names (an older server sends no list). */
export function storyPurchaseIds(w: Pick<Wallet, "story_purchase_ids" | "stories" | "waiting_stories">): Set<string> {
  return new Set([
    ...(w.story_purchase_ids ?? []),
    ...(w.stories ?? []).map((s) => s.purchase_id),
    ...(w.waiting_stories ?? []).map((s) => s.purchase_id),
  ]);
}

/** The Story that speaks for a purchase: an open one, else the released
 *  one, else the newest void (the server's readOwnStory order). */
export function storyForPurchase(stories: readonly StoryTicket[] | undefined, purchaseId: string): StoryTicket | null {
  const mine = (stories ?? []).filter((s) => s.purchase_id === purchaseId);
  return (
    mine.find((s) => OPEN.has(s.state)) ??
    mine.find((s) => s.state === "released") ??
    [...mine].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ??
    null
  );
}

/** How far a Story voucher got. */
export function storyVoucherStage(story: Pick<StoryTicket, "state" | "bonus_at"> | null, refunded: boolean, now = Date.now()): StoryVoucherStage {
  if (refunded) return "lost";
  if (story?.state === "released") return "done";
  if (story?.state === "approved") {
    const at = story.bonus_at ? Date.parse(story.bonus_at) : Number.NaN;
    return Number.isFinite(at) && at > now ? "wait" : "check";
  }
  return "post";
}

/** The row's state word and its one line. */
export function storyVoucherWords(stage: StoryVoucherStage): { label: string; line: string } {
  switch (stage) {
    case "post":
      return { label: "Post Story", line: "Post a story tagging the place, then keep it up" };
    case "wait":
      return { label: "Waiting", line: "Keep your story up" };
    case "check":
      return { label: "Checking", line: "Checking your story" };
    case "done":
      return { label: "Bonus added", line: "Story voucher" };
    default:
      return { label: "Bonus not added", line: "Story voucher" };
  }
}

/** Still to resolve: Pay's Pending Tickets lists it, Tickets paints it blue. */
export function storyVoucherOpen(stage: StoryVoucherStage): boolean {
  return stage === "post" || stage === "wait" || stage === "check";
}
