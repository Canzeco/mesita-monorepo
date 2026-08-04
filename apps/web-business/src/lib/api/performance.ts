import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF, withPlaceId } from "./_invoke";

// v3d Performance (MESITA-852) — the place's whole record in one call.
//
// Nothing here is class-shaped, by design: blended-rate privacy means a place
// never learns which guests were Premium (Product Rules §A). The issue's
// "redemption by segment" is therefore reported by ACTION.
//
// `saved` is the first funnel stage because it is the first one with a real
// row behind it — this database records no views or swipes, so the tab says
// so rather than showing a fabricated zero.

export type PerformanceSummary = {
  saved: number;
  ticketsOpened: number;
  visits: number;
  honored: number;
  cancelled: number;
  guests: number;
  repeatGuests: number;
  influencedCents: number;
  discountCents: number;
  billedCount: number;
  /** Of `billedCount`, how many amounts the GUEST typed (v3b provenance). */
  consumerReportedCount: number;
  avgTicketCents: number | null;
  byAction: { welcome: number; story: number; review: number };
  currency: string;
};

export type PerformanceReview = {
  id: string;
  food: number | null;
  service: number | null;
  ambiance: number | null;
  value: number | null;
  overall: number | null;
  comments: string | null;
  createdAt: string;
  guestFirstName: string | null;
};

export type PerformanceContent = {
  mesitaReviews: PerformanceReview[];
  storiesPosted: number;
  googleReviews: number;
};

export type PerformanceFeedItem = {
  id: string;
  type: string;
  occurredAt: string;
  meta: Record<string, unknown>;
};

export type PlacePerformance = {
  summary: PerformanceSummary;
  content: PerformanceContent;
  feed: PerformanceFeedItem[];
};

export async function getPlacePerformance(
  client: SupabaseClient,
  projectId: string,
): Promise<PlacePerformance> {
  const res = await invokeEF<PlacePerformance>(
    client,
    "business-web-get-performance",
    withPlaceId({ projectId }),
    "Could not load performance.",
  );
  return res;
}
