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

/** Opens a visit here, or replaces the open one: that is how a guest starts over. */
export async function apiCreateVisitCode(client: SupabaseClient, placeId: string): Promise<VisitCode> {
  return await invokeEF<VisitCode>(client, "consumer-web-create-visit-code", { place_id: placeId });
}

export type VisitQuote = { percent: number; discount_cents: number; total_cents: number };

/** The shared visit (MESITA-3270), the same picture staff's page reads. Every number
 *  and the step are the server's. */
export type OpenVisit = {
  currency: string;
  opened_at: string | null;
  bill_cents: number | null;
  bill_confirmed_at: string | null;
  story: boolean;
  story_offered: boolean;
  /** The rewards that count right now: Story only once staff saw it. */
  rewards: { kind: RewardKind; percent: number; cap_cents: number | null }[];
  quote: VisitQuote | null;
  quote_with_story: VisitQuote | null;
  step: "bill" | "task" | "pay";
};

/** This guest's open visit here, or null when there is none. */
export async function apiGetVisit(client: SupabaseClient, placeId: string): Promise<OpenVisit | null> {
  const res = await invokeEF<{ visit: OpenVisit | null }>(client, "consumer-web-get-visit", { place_id: placeId });
  return res.visit;
}

/** The guest signs the number they saw. A bill staff just changed is refused (bill_changed). */
export async function apiConfirmBill(client: SupabaseClient, placeId: string, billCents: number): Promise<OpenVisit> {
  const res = await invokeEF<{ visit: OpenVisit }>(client, "consumer-web-confirm-bill", { place_id: placeId, bill_cents: billCents });
  return res.visit;
}

/** No story today. */
export async function apiSkipTask(client: SupabaseClient, placeId: string): Promise<OpenVisit | null> {
  const res = await invokeEF<{ visit: OpenVisit | null }>(client, "consumer-web-skip-task", { place_id: placeId });
  return res.visit;
}

export type GuestVisit = {
  id: string;
  place_id: string;
  place_name: string | null;
  photo: string | null;
  bill_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
};

/** This guest's closed visits, newest first (MESITA-3264). `next` is the `before` of the next page. */
export async function apiListVisits(client: SupabaseClient, before?: string): Promise<{ visits: GuestVisit[]; next: string | null }> {
  return await invokeEF<{ visits: GuestVisit[]; next: string | null }>(client, "consumer-web-list-visits", before ? { before } : {});
}

export type VisitResult = { bill_cents: number; discount_cents: number; total_cents: number; currency: string };

/** What staff closed for this guest here since `since`, or null while they haven't (MESITA-3256). */
export async function apiGetVisitResult(client: SupabaseClient, placeId: string, since: string): Promise<VisitResult | null> {
  const res = await invokeEF<{ visit: VisitResult | null }>(client, "consumer-web-get-visit-result", { place_id: placeId, since });
  return res.visit;
}

/** What the guest's QR holds (MESITA-3240): a phone camera opens this page. */
export function visitLink(placeId: string, code: string): string {
  return `https://visit.mesita.ai/?place=${encodeURIComponent(placeId)}&code=${encodeURIComponent(code)}`;
}
