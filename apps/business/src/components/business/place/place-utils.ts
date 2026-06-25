import { resolveVenueCategoryName } from "@/lib/venue-category";
import type { MyVenue } from "@/lib/api/venues";
import { SUBSCRIPTIONS, subscriptionForVenue } from "@/lib/business/plans";

export const PLACE_DESCRIPTION_MAX = 2000;

export const PLACE_DESCRIPTION_PLACEHOLDER =
  "Describe your vibe, what you serve, and what makes you worth a visit.";

const PRICE_LEVEL_MAX = 4;

const PRICE_TIER_LABEL: Record<number, string> = {
  1: "Budget",
  2: "Casual",
  3: "Upscale",
  4: "Fine dining",
};

export function humanizeVenueToken(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveVenueCategory(venue: MyVenue): string {
  return (
    resolveVenueCategoryName({
      categoryLabel: venue.category_label,
      category: venue.category,
    }) ?? "—"
  );
}

export function resolveVenuePriceLabel(venue: MyVenue): string {
  if (venue.price_level == null) return "—";
  const level = Math.max(1, Math.min(PRICE_LEVEL_MAX, venue.price_level));
  return `${PRICE_TIER_LABEL[level]} · ${"$".repeat(level)}`;
}

export type VenueVerificationPresentation = {
  label: string;
  hint?: string;
  tone: "verified" | "pending" | "unverified";
};

export function resolveVenueVerification(
  _venue: MyVenue,
): VenueVerificationPresentation {
  // MyVenue is only returned for signed-in venue members. If Place is
  // reachable, ownership is verified — listing_type is catalog tier, not
  // ownership (see mesita-supabase venue-ownership.ts).
  return { label: "Verified", tone: "verified" };
}

export function resolveVenueTierLabel(venue: MyVenue): string {
  const sub = SUBSCRIPTIONS.find(
    (row) => row.id === subscriptionForVenue(venue.plan),
  );
  const planLabel = sub?.label ?? humanizeVenueToken(venue.plan);
  const partnership = venue.listing_type === "partner" ? "Partner" : "Listed";
  return `${partnership} · ${planLabel}`;
}
