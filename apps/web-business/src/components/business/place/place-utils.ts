import { resolvePlaceCategoryName } from "@/lib/place-category";
import type { MyPlace } from "@/lib/api/places";
import { SUBSCRIPTIONS, subscriptionForPlace } from "@/lib/business/plans";

export const PLACE_DESCRIPTION_MAX = 2000;
export const PLACE_NAME_MAX = 80;

export const PLACE_DESCRIPTION_PLACEHOLDER =
  "Describe your vibe, what you serve, and what makes you worth a visit.";

export function humanizePlaceToken(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function placeCategoryName(place: MyPlace): string | null {
  return resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
}

// Compact "vibe · category" subtitle for a place, falling back to its
// address (or the caller's `emptyFallback`) when neither is present.
export function placeSubtitle(place: MyPlace, emptyFallback = "—"): string {
  const parts = [place.vibe, placeCategoryName(place)].filter(
    Boolean,
  ) as string[];
  if (parts.length > 0) return parts.join(" · ");
  return place.address ?? emptyFallback;
}

// Turn a snake_case slug into a spaced label (no title-casing — for that
// use humanizePlaceToken).
export function deslugify(slug: string): string {
  return slug.replace(/_/g, " ");
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
