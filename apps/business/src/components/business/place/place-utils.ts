import { resolvePlaceCategoryName } from "@/lib/place-category";
import type { MyPlace } from "@/lib/api/places";
import { SUBSCRIPTIONS, subscriptionForPlace } from "@/lib/business/plans";

export const PLACE_DESCRIPTION_MAX = 2000;
export const PLACE_PLACE_NAME_MAX = 80;

export const PLACE_DESCRIPTION_PLACEHOLDER =
  "Describe your vibe, what you serve, and what makes you worth a visit.";

const PRICE_LEVEL_MAX = 4;

const PRICE_TIER_LABEL: Record<number, string> = {
  1: "Budget",
  2: "Casual",
  3: "Upscale",
  4: "Fine dining",
};

export function humanizePlaceToken(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolvePlaceCategory(place: MyPlace): string {
  return (
    resolvePlaceCategoryName({
      categoryLabel: place.category_label,
      category: place.category,
    }) ?? "—"
  );
}

export function resolvePlacePriceLabel(place: MyPlace): string {
  if (place.price_level == null) return "—";
  const level = Math.max(1, Math.min(PRICE_LEVEL_MAX, place.price_level));
  return `${PRICE_TIER_LABEL[level]} · ${"$".repeat(level)}`;
}

export type PlaceVerificationPresentation = {
  label: string;
  hint?: string;
  tone: "verified" | "pending" | "unverified";
};

export function resolvePlaceVerification(
  _place: MyPlace,
): PlaceVerificationPresentation {
  // MyPlace is only returned for signed-in place members. If Place is
  // reachable, ownership is verified — listing_type is catalog tier, not
  // ownership (see mesita-supabase project-ownership.ts).
  return { label: "Verified", tone: "verified" };
}

export function resolvePlaceTierLabel(place: MyPlace): string {
  const sub = SUBSCRIPTIONS.find(
    (row) => row.id === subscriptionForPlace(place.plan),
  );
  const planLabel = sub?.label ?? humanizePlaceToken(place.plan);
  const partnership = place.listing_type === "partner" ? "Partner" : "Listed";
  return `${partnership} · ${planLabel}`;
}
