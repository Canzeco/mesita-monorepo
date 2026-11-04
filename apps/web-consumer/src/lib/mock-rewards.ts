// MOCK REWARDS (Pato, MESITA-3218: "for the moment we are going to only use mock
// data"). What guests read on the place screen, the cards and the Reward tab while
// no place has rewards on. It promises what the till does not give: a place with
// nothing on takes nothing off, so turn this off before real guests rely on it.
//
// The one switch: false removes every mock number. Places with rewards really on
// (place_rewards) always show their real ones.

import { isMesitaPlaceId } from "@/lib/api/activity";
import type { PlaceReward } from "@/lib/api/rewards";

export const MOCK_REWARDS_ON = true;

const MOCK_PERCENT = 30;
/** The most the mock discount takes off, in pesos (Pato, MESITA-3248: "keep it up
 *  to $200"; MESITA-3231 for the words). */
const MOCK_MAX_OFF_PESOS = 200;

/** The summary after the price: "30% OFF, up to $200 MXN", or null for a card with no Mesita row. */
export function mockRewardLabel(placeId: string): string | null {
  return MOCK_REWARDS_ON && isMesitaPlaceId(placeId) ? `${MOCK_PERCENT}% OFF, up to $${MOCK_MAX_OFF_PESOS} MXN` : null;
}

/** The Reward tab's "Up to N%" when the server has no real number. */
export function mockRewardPercent(placeId: string): number | undefined {
  return MOCK_REWARDS_ON && isMesitaPlaceId(placeId) ? MOCK_PERCENT : undefined;
}

/** The matrix on a place's Rewards tab, the same one Business switches on. */
export const MOCK_REWARDS: PlaceReward[] = MOCK_REWARDS_ON
  ? [
      { kind: "welcome_visit", percent: 20, cap_cents: null, eligible: true, reason: null },
      { kind: "returning_visit", percent: 10, cap_cents: null, eligible: true, reason: null },
      { kind: "instagram_story", percent: 20, cap_cents: null, eligible: true, reason: null },
      { kind: "vip_class", percent: 20, cap_cents: null, eligible: true, reason: null },
    ]
  : [];
