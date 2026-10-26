"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { usePlaceContext } from "./PlaceContext";

// Read-only. google_types is what Google returned; mesita_categories is the
// LLM's pick from the place_categories slugs. Labels come from the category
// options the overview already joined. A stored label leads with an emoji;
// it is dropped here, since only Mesita families wear one (MESITA-2771).

// Google's Table B: generic markers it returns beside the real types
// (point_of_interest, establishment, food, the address parts). They name no
// kind of place and cannot be searched, so the Google categories row leaves
// them out (Pato, MESITA-2783: "some of those are not really Google
// Categories"). google_types still stores them as Google sent them.
// https://developers.google.com/maps/documentation/places/web-service/place-types
const GOOGLE_TABLE_B = new Set([
  "administrative_area_level_3",
  "administrative_area_level_4",
  "administrative_area_level_5",
  "administrative_area_level_6",
  "administrative_area_level_7",
  "archipelago",
  "colloquial_area",
  "continent",
  "establishment",
  "finance",
  "food",
  "general_contractor",
  "geocode",
  "health",
  "intersection",
  "landmark",
  "natural_feature",
  "neighborhood",
  "place_of_worship",
  "plus_code",
  "point_of_interest",
  "political",
  "postal_code_prefix",
  "postal_code_suffix",
  "postal_town",
  "premise",
  "route",
  "street_address",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "sublocality_level_3",
  "sublocality_level_4",
  "sublocality_level_5",
  "subpremise",
  "town_square",
]);

function withoutEmoji(label: string): string {
  const start = label.search(/[\p{L}\p{N}]/u);
  return start > 0 ? label.slice(start).trim() : label.trim();
}

function slugsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) =>
      typeof v === "string"
        ? v
        : v && typeof v === "object" && typeof (v as { key?: unknown }).key === "string"
          ? (v as { key: string }).key
          : "",
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

function CategoryChips({ slugs }: { slugs: string[] }) {
  const { profile } = usePlaceContext();
  if (slugs.length === 0) return <>—</>;
  const labels = new Map(profile.categories.map((c) => [c.slug, c.label]));
  return (
    <span className="flex flex-wrap gap-1.5">
      {slugs.map((slug) => (
        <span
          key={slug}
          className="border-border rounded-full border px-2 py-0.5 text-xs"
        >
          {withoutEmoji(labels.get(slug) || slug.replaceAll("_", " "))}
        </span>
      ))}
    </span>
  );
}

export function PlaceMesitaCategoriesField() {
  const { place } = usePlaceContext();
  return (
    <ReadField label="Mesita categories" auto boxed>
      <CategoryChips slugs={slugsOf(place.mesita_categories)} />
    </ReadField>
  );
}

export function PlaceGoogleCategoriesField() {
  const { place } = usePlaceContext();
  return (
    <ReadField label="Google categories" auto boxed>
      <CategoryChips
        slugs={slugsOf(place.google_types).filter((s) => !GOOGLE_TABLE_B.has(s))}
      />
    </ReadField>
  );
}
