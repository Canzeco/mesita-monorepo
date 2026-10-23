import type { PlaceOpenOutcome } from "@/app/(app)/enricher-config/actions";

export type OperatorVerbCounts = Record<
  "create" | "update" | "enrich" | "edit",
  { succeeded: number; failed: number }
>;

export type ActivitySummary = {
  windowDays: number;
  capped: { guestOpens: boolean; operator: boolean };
  guestOpens: {
    opens: number;
    byOutcome: Record<PlaceOpenOutcome, number>;
    places: number;
    profileRate: number;
    repeated: Array<{
      googlePlaceId: string;
      opens: number;
      created: boolean;
      placeId: string | null;
    }>;
  };
  guestSocial: {
    viewedMembers: number;
    savedMembers: number;
    viewedEvents: number;
    savedEvents: number;
  };
  operatorVerbs: OperatorVerbCounts;
  names: Record<string, string>;
  recentFeed: Array<{ id: string; at: string; line: string }>;
};
