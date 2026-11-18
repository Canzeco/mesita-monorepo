// The Story's gate (MESITA-4296; since MESITA-4405 it no longer looks for a
// story before payment: the Story record does that after the money lands).
// One pure decision for consumer-web-check-story: may this guest buy the
// Story voucher here? The order is fixed; the first reason that applies wins:
//   place_no_instagram  the place has no Instagram to mention (MESITA-4291)
//   needs_instagram     the guest has no verified Instagram
//   few_followers       fewer than 1,000 followers (MESITA-3507, MESITA-4383)
//   private_account     not known public (MESITA-4263): its mentions never arrive
//   already_bought      one each visit (MESITA-3463)
//   story_unavailable   live payments with Meta off: no story can arrive
//   not_available       the place does not sell Story right now (paused, …)

export type StoryCheckReason =
  | "place_no_instagram"
  | "needs_instagram"
  | "few_followers"
  | "private_account"
  | "already_bought"
  | "story_unavailable"
  | "not_available";

export const STORY_GATE_REASONS: readonly StoryCheckReason[] = [
  "place_no_instagram",
  "needs_instagram",
  "few_followers",
  "private_account",
  "already_bought",
  "story_unavailable",
  "not_available",
];

export type StoryGateInput = {
  placeInstagram: boolean;
  /** storyRefusal's code for this guest, or null when they pass it. */
  guestRefusal: "needs_instagram" | "few_followers" | "private_account" | string | null;
  /** The offer's reason Story is not sold here (`needs_visit`, `paused`, `off`…), or null when it is. */
  offerReason: string | null;
  mode: "meta" | "emulated" | "unavailable";
};

/** The first reason this guest cannot buy Story here, or null. */
export function storyGate(i: StoryGateInput): StoryCheckReason | null {
  if (!i.placeInstagram) return "place_no_instagram";
  if (i.guestRefusal === "needs_instagram" || i.guestRefusal === "few_followers" || i.guestRefusal === "private_account") {
    return i.guestRefusal;
  }
  if (i.offerReason === "needs_visit") return "already_bought";
  if (i.mode === "unavailable") return "story_unavailable";
  if (i.offerReason) return "not_available";
  return null;
}
