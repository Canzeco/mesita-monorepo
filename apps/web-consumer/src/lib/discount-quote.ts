import type { RewardQuote } from "@/lib/api/tickets";

// The ceiling a guest can reach at one place — ONE definition, read by every
// surface that prints it (MESITA-1019).
//
// It lived inline in the place-detail Rewards box while the promo chip
// computed its own number from the place's four v4 rate columns. Those columns
// carry strategy IDENTITY, not price, so the two disagreed in the same words
// on the same screen: an aggressive place quoted a bronze·free guest "Up to
// 30%" in the header chip and "Up to 60%" in the box below it. Neither the
// guaranteed base (20) nor the reachable ceiling (60) was 30.
//
// `additive` is load-bearing, not decoration: under the v11 engine the
// components ADD (base + welcome + every bonus), but on the legacy best-of
// fallback they don't, and a total that summed them would over-promise. That
// is the one direction of error a discount quote must never make, so the
// arithmetic switches on the flag the server sends rather than assuming.
//
// Welcome is included exactly as the server sent it: the EF reports
// `bonuses.welcome` as 0 once the guest has been here before, so a returning
// guest's ceiling drops on its own. Story is counted even when
// `storyEligible` is false — connecting Instagram is a door the guest can
// open today, and "up to" is what the program can pay, not what this second
// permits.
export function upToPercentFromQuote(quote: RewardQuote): number {
  const b = quote.bonuses;
  if (!quote.additive) {
    return Math.max(quote.base, b.welcome, b.story, b.google);
  }
  return Math.min(100, quote.base + b.welcome + b.story + b.google + b.mesita);
}
