// The Story check before Pay (MESITA-4296). Pato, 2026-11-17: "sí quiero
// hacer la verificación de la historia antes, que no pagues antes de eso".
// One pure decision for consumer-web-check-story and the buy: the gate
// reasons first (they need no story), then the story itself.
//
// The order is fixed; the first reason that applies wins:
//   place_no_instagram  the place has no Instagram to mention (MESITA-4291)
//   needs_instagram     the guest has no verified Instagram
//   few_followers       1,000 followers or fewer (MESITA-3507)
//   private_account     not known public (MESITA-4263): its mentions never arrive
//   already_bought      one each visit (MESITA-3463)
//   story_unavailable   live payments with Meta off: no story can arrive
//   not_available       the place does not sell Story right now (paused, …)
//   no_story            no story of this handle has reached Mesita
//   story_too_old       the newest story would end before the re-check

import { mentionAlive, mentionFits, type MentionRow, type StoryRulesLive } from "./story-mention.ts";

export type StoryCheckReason =
  | "place_no_instagram"
  | "needs_instagram"
  | "few_followers"
  | "private_account"
  | "already_bought"
  | "story_unavailable"
  | "not_available"
  | "no_story"
  | "story_too_old";

/** The reasons a guest can act on before posting: the sheet hides the Post
 *  step for these (no point posting a story that can never count). */
export const STORY_GATE_REASONS: readonly StoryCheckReason[] = [
  "place_no_instagram",
  "needs_instagram",
  "few_followers",
  "private_account",
  "already_bought",
  "story_unavailable",
  "not_available",
];

export function isStoryGateReason(r: StoryCheckReason): boolean {
  return STORY_GATE_REASONS.includes(r);
}

export type StoryCheckInput = {
  placeInstagram: boolean;
  /** storyRefusal's code for this guest, or null when they pass it. */
  guestRefusal: "needs_instagram" | "few_followers" | "private_account" | string | null;
  /** The offer's reason Story is not sold here (`needs_visit`, `paused`, `off`…), or null when it is. */
  offerReason: string | null;
  mode: "meta" | "emulated" | "unavailable";
  /** The guest's unclaimed, unreserved mentions, newest first (readCandidateMentions). */
  candidates: MentionRow[];
  livemode: boolean;
  nowMs: number;
  rules: Pick<StoryRulesLive, "bonusWaitSec" | "checkMarginSec">;
  /** Skip the gate (the sheet's poll after the gate passed once). */
  pollOnly?: boolean;
};

export type StoryCheckResult =
  | { found: true; mention: MentionRow }
  | { found: false; reason: StoryCheckReason };

export function storyCheck(i: StoryCheckInput): StoryCheckResult {
  if (!i.pollOnly) {
    if (!i.placeInstagram) return { found: false, reason: "place_no_instagram" };
    if (i.guestRefusal === "needs_instagram" || i.guestRefusal === "few_followers" || i.guestRefusal === "private_account") {
      return { found: false, reason: i.guestRefusal };
    }
    if (i.offerReason === "needs_visit") return { found: false, reason: "already_bought" };
    if (i.mode === "unavailable") return { found: false, reason: "story_unavailable" };
    if (i.offerReason) return { found: false, reason: "not_available" };
  }
  const alive = i.candidates.filter((m) => mentionAlive(m, i.nowMs));
  const fit = alive.find((m) => mentionFits(m, i.livemode, i.nowMs, i.rules, i.rules.checkMarginSec));
  if (fit) return { found: true, mention: fit };
  return { found: false, reason: alive.length > 0 ? "story_too_old" : "no_story" };
}
