"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { usePlaceContext } from "./PlaceContext";

// Read-only. Both lists speak Google's type vocabulary: google_types is what
// Google returned, mesita_categories is the LLM's pick from that same list.
// Labels come from the category options the overview already joined.

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
          {labels.get(slug) || slug.replaceAll("_", " ")}
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
      <CategoryChips slugs={slugsOf(place.google_types)} />
    </ReadField>
  );
}
