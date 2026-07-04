// Filter chips for the Search surface.
//
// Everything with a `match` predicate filters the catalog rail + map pins
// CLIENT-side off real fields already on the public places projection
// (vibe/category/tags text, price_level, the open_now derived by
// enrichPlaceOverview from the hours table, reservation channels).
// Chips without a predicate are visual placeholders in the filter sheet —
// the data to honour them doesn't ride on Place yet.
// TODO(EF): recommender filters — walk-in / pet-friendly / quiet etc. need
// the recommender EFs to expose those signals before they can filter.

import type { Place } from "@/lib/api/places";

export type ChipTone = "vibe" | "availability" | "price";

export type FilterChip = {
  id: string;
  label: string;
  tone: ChipTone;
  /** Real client-side predicate. Absent = sheet-only visual, marked soon. */
  match?: (place: Place) => boolean;
};

// Free-text haystack over the fields a vibe word could live in. `tags`
// rides on the raw row (PLACE_PUBLIC_COLUMNS) even though it's absent from
// the Place type, so read it defensively.
function haystack(place: Place): string {
  const row = place as unknown as Record<string, unknown>;
  const tags = Array.isArray(row.tags)
    ? (row.tags as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  return [
    place.name,
    place.vibe,
    place.category,
    place.category_label,
    place.pitch,
    ...tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function textMatch(...needles: string[]): (place: Place) => boolean {
  return (place) => {
    const hay = haystack(place);
    return needles.some((n) => hay.includes(n));
  };
}

const VIBE_CHIPS: FilterChip[] = [
  { id: "rooftop", label: "Rooftop", tone: "vibe", match: textMatch("rooftop", "terraza", "terrace") },
  { id: "cocktails", label: "Cocktails", tone: "vibe", match: textMatch("cocktail", "coctel", "cóctel", "bar", "mixolog") },
  { id: "brunch", label: "Brunch", tone: "vibe", match: textMatch("brunch", "breakfast", "desayuno", "cafe", "café", "coffee") },
  { id: "date-night", label: "Date night", tone: "vibe", match: textMatch("date", "romantic", "romántic", "intimate", "fine dining") },
  { id: "late-night", label: "Late-night", tone: "vibe", match: textMatch("late", "night", "club", "antro", "cantina") },
  { id: "outdoor", label: "Outdoor", tone: "vibe", match: textMatch("outdoor", "patio", "garden", "jardín", "al aire libre", "terraza") },
  { id: "live-music", label: "Live music", tone: "vibe", match: textMatch("live music", "música en vivo", "musica en vivo", "jazz", "dj") },
];

const AVAILABILITY_CHIPS: FilterChip[] = [
  {
    id: "open-now",
    label: "Open now",
    tone: "availability",
    // Real: enrichPlaceOverview runs the detail page's computeOpenState
    // over the row's hours table. Places without an hours table don't
    // qualify — an "Open now" filter that guesses is worse than a
    // smaller honest result set.
    match: (place) => place.open_now === true,
  },
  {
    id: "reservable",
    label: "Reservable",
    tone: "availability",
    // Real: Verified Partners take Mesita reservations; web listings
    // count when they carry a booking channel.
    match: (place) =>
      place.listing_type === "partner" ||
      !!place.opentable_url ||
      !!place.resy_url,
  },
  // TODO(EF): recommender filters — no walk-in signal on Place yet.
  { id: "walk-in", label: "Walk-in", tone: "availability" },
];

const PRICE_CHIPS: FilterChip[] = [1, 2, 3, 4].map((level) => ({
  id: `price-${level}`,
  label: "$".repeat(level),
  tone: "price" as const,
  match: (place: Place) => place.price_level === level,
}));

// TODO(EF): recommender filters — sheet-only until the signals exist.
const SOON_CHIPS: FilterChip[] = [
  { id: "pet-friendly", label: "Pet friendly", tone: "vibe" },
  { id: "quiet", label: "Quiet", tone: "vibe" },
];

export const CHIP_GROUPS: {
  key: string;
  label: string;
  chips: FilterChip[];
}[] = [
  { key: "vibe", label: "Vibe & category", chips: [...VIBE_CHIPS, ...SOON_CHIPS] },
  { key: "availability", label: "Availability", chips: AVAILABILITY_CHIPS },
  { key: "price", label: "Price", chips: PRICE_CHIPS },
];

// The quick row under the search bar: filterable chips only, most useful
// first. Sheet-only placeholders stay in the sheet.
export const QUICK_CHIPS: FilterChip[] = [
  AVAILABILITY_CHIPS[0],
  ...VIBE_CHIPS,
  PRICE_CHIPS[1],
];

const ALL_CHIPS = new Map<string, FilterChip>(
  CHIP_GROUPS.flatMap((g) => g.chips).map((c) => [c.id, c]),
);

export function chipById(id: string): FilterChip | undefined {
  return ALL_CHIPS.get(id);
}

/**
 * Faceted filtering: OR within a tone group, AND across groups. Chips
 * without a predicate never restrict results.
 */
export function applyChipFilters(places: Place[], activeIds: string[]): Place[] {
  const groups = new Map<ChipTone, FilterChip[]>();
  for (const id of activeIds) {
    const chip = chipById(id);
    if (!chip?.match) continue;
    const list = groups.get(chip.tone) ?? [];
    list.push(chip);
    groups.set(chip.tone, list);
  }
  if (groups.size === 0) return places;
  return places.filter((place) =>
    Array.from(groups.values()).every((chips) =>
      chips.some((chip) => chip.match!(place)),
    ),
  );
}
