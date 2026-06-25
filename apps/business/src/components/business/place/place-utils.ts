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
  venue: MyVenue,
): VenueVerificationPresentation {
  if (venue.listing_type === "partner") {
    return { label: "Verified", tone: "verified" };
  }

  if (
    venue.status === "pending_verification" ||
    venue.status === "pending_review"
  ) {
    return {
      label: "Pending",
      hint: "Ownership under review",
      tone: "pending",
    };
  }

  if (venue.listing_type === "web") {
    return {
      label: "Not verified",
      hint: "Verify ownership to become a partner",
      tone: "unverified",
    };
  }

  return { label: "Not verified", tone: "unverified" };
}

export function resolveVenueTierLabel(venue: MyVenue): string {
  const sub = SUBSCRIPTIONS.find(
    (row) => row.id === subscriptionForVenue(venue.plan),
  );
  const planLabel = sub?.label ?? humanizeVenueToken(venue.plan);
  const partnership = venue.listing_type === "partner" ? "Partner" : "Listed";
  return `${partnership} · ${planLabel}`;
}
