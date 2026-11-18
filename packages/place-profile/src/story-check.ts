// THE STORY GATE ON OFFERS (MESITA-4296; since MESITA-4405 the Story voucher
// PAYS FIRST). The Story page on Offers asks consumer-web-check-story (through
// the host's onCheckStory) only whether this guest may buy Story here; the
// posting, the waiter's QR and the bonus live on the Story's own screen
// (Me › Tickets › Stories), which the guest lands on right after paying.
// This module is the page's pure half: the answer's shape and the words for
// each gate reason. No React, no network: the host does the call.

/** Why Story cannot be bought here, in the server's fixed order (_shared/story-check.ts). */
export type StoryGateReason =
  | "place_no_instagram"
  | "needs_instagram"
  | "few_followers"
  | "private_account"
  | "already_bought"
  | "story_unavailable"
  | "not_available";

/** The old name, kept for the host's imports. */
export type StoryCheckReason = StoryGateReason;

export const STORY_GATE_REASONS: readonly StoryGateReason[] = [
  "place_no_instagram",
  "needs_instagram",
  "few_followers",
  "private_account",
  "already_bought",
  "story_unavailable",
  "not_available",
];

export function isStoryGateReason(r: unknown): r is StoryGateReason {
  return (STORY_GATE_REASONS as readonly unknown[]).includes(r);
}

/** One answer of the gate, as the host hands it to the page. `failed` is a
 *  500 or no answer: the page lets the guest try to buy (the server is the
 *  last word at the buy). */
export type StoryCheckAnswer =
  | { kind: "ready"; placeHandle: string | null }
  | { kind: "gate"; reason: StoryGateReason; placeHandle: string | null }
  | { kind: "failed" };

/** What the gate offers to lift it: the host's Instagram page (link or sync
 *  it), or nothing the guest can do here. */
export type StoryGateAction = "link_instagram" | "sync_instagram" | null;

export const STORY_GATE_LINE: Record<StoryGateReason, { text: string; action: StoryGateAction }> = {
  place_no_instagram: { text: "This place hasn't linked its Instagram yet, so Story isn't available here.", action: null },
  needs_instagram: { text: "Link your Instagram to use Story.", action: "link_instagram" },
  few_followers: { text: "Story is for Instagram accounts with 1,000 or more followers.", action: null },
  private_account: { text: "Your Instagram is private. Make it public, then sync it.", action: "sync_instagram" },
  already_bought: { text: "One Story per visit. Pay a bill here by card to get another.", action: null },
  story_unavailable: { text: "Story isn't available right now.", action: null },
  not_available: { text: "This place isn't selling Story right now.", action: null },
};
