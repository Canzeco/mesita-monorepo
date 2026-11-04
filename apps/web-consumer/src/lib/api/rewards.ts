// A place's Rewards on the place screen (MESITA-3202): what it offers, which
// are this guest's, and the code the guest shows staff. Who qualifies and every
// number is the server's.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type RewardKind = "welcome_visit" | "returning_visit" | "instagram_story" | "vip_class";

export type PlaceReward = {
  kind: RewardKind;
  percent: number;
  /** The most it takes off one bill, when the place's Cap is on. */
  cap_cents: number | null;
  eligible: boolean;
  reason: string | null;
};

export type PlaceRewards = { signed_in: boolean; rewards: PlaceReward[] };

export async function apiGetPlaceRewards(client: SupabaseClient, placeId: string): Promise<PlaceRewards> {
  return await invokeEF<PlaceRewards>(client, "consumer-web-get-place-rewards", { place_id: placeId });
}

/** Each place's "Up to N%" for this guest (MESITA-3217). A place with nothing on
 *  is left out. Mesita places only: a Google-only card has no rewards row. */
export async function apiListRewardPercents(client: SupabaseClient, placeIds: string[]): Promise<Record<string, number>> {
  const res = await invokeEF<{ percents: Record<string, number> }>(client, "consumer-web-list-reward-percents", {
    place_ids: placeIds,
  });
  return res.percents ?? {};
}

export type VisitCode = { code: string; expires_at: string };

export async function apiCreateVisitCode(client: SupabaseClient, placeId: string): Promise<VisitCode> {
  return await invokeEF<VisitCode>(client, "consumer-web-create-visit-code", { place_id: placeId });
}

/** What the guest's QR holds (MESITA-3240): a phone camera opens this page. */
export function visitLink(placeId: string, code: string): string {
  return `https://visit.mesita.ai/?place=${encodeURIComponent(placeId)}&code=${encodeURIComponent(code)}`;
}
