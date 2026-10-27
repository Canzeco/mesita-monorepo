"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { usePlaceContext } from "./PlaceContext";

// Read-only until MESITA-2829. google_types is the place's 1–3 Google
// categories (Google's canonical list), picked by a model on Create and every
// Enrich, the shown one first (MESITA-2827). tags is the Mesita tags the same
// runs pick from place_tags. Labels come from the
// vocabularies the overview already joined. A stored category label leads
// with an emoji; it is dropped here, since only families wear one.

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

// One chip look for every list row in Basics, Families included (Pato,
// MESITA-2810). Google's primary category is simply the first chip.
export function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <>—</>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-border px-2 py-0.5 text-xs"
        >
          {item}
        </span>
      ))}
    </span>
  );
}

function Chips({
  slugs,
  labels,
}: {
  slugs: string[];
  labels: Map<string, string>;
}) {
  return (
    <ChipList
      items={slugs.map((slug) =>
        withoutEmoji(labels.get(slug) || slug.replaceAll("_", " ")),
      )}
    />
  );
}

function useCategoryLabels(): Map<string, string> {
  const { profile } = usePlaceContext();
  return new Map(profile.categories.map((c) => [c.slug, c.label]));
}

export function PlaceGoogleCategoriesField() {
  const { place } = usePlaceContext();
  const labels = useCategoryLabels();
  return (
    <ReadField label="Google categories" auto boxed>
      <Chips
        slugs={slugsOf(place.google_types).filter((s) => !GOOGLE_TABLE_B.has(s))}
        labels={labels}
      />
    </ReadField>
  );
}

export function PlaceMesitaTagsField() {
  const { place, profile } = usePlaceContext();
  const labels = new Map(profile.tags.map((t) => [t.slug, t.label_en]));
  return (
    <ReadField label="Mesita tags" auto boxed>
      <Chips slugs={slugsOf(place.tags)} labels={labels} />
    </ReadField>
  );
}
