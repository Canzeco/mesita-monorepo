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

export type VisitCode = { code: string; expires_at: string };

export async function apiCreateVisitCode(client: SupabaseClient, placeId: string): Promise<VisitCode> {
  return await invokeEF<VisitCode>(client, "consumer-web-create-visit-code", { place_id: placeId });
}
