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

export type VisitCode = { code: string; issued_at: string; expires_at: string };

export async function apiCreateVisitCode(client: SupabaseClient, placeId: string, billCents: number): Promise<VisitCode> {
  return await invokeEF<VisitCode>(client, "consumer-web-create-visit-code", { place_id: placeId, bill_cents: billCents });
}

export type VisitResult = { bill_cents: number; discount_cents: number; total_cents: number; currency: string };

/** What staff closed for this guest here since `since`, or null while they haven't (MESITA-3256). */
export async function apiGetVisitResult(client: SupabaseClient, placeId: string, since: string): Promise<VisitResult | null> {
  const res = await invokeEF<{ visit: VisitResult | null }>(client, "consumer-web-get-visit-result", { place_id: placeId, since });
  return res.visit;
}

/** "1,234.50" as whole cents, or null. On the digits, so no float touches it. */
export function readBill(text: string): number | null {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text.replace(/[,\s]/g, ""));
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

/** What the guest's QR holds (MESITA-3240): a phone camera opens this page. */
export function visitLink(placeId: string, code: string): string {
  return `https://visit.mesita.ai/?place=${encodeURIComponent(placeId)}&code=${encodeURIComponent(code)}`;
}
