import { z } from "zod";

import { EdgeError, callEdge } from "@/lib/edge";

const text = z.string().nullish().catch(null);
const number = z.coerce.number().nullish().catch(null);

export type Place = {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  photo: string | null;
  phone: string | null;
  address: string | null;
  pitch: string | null;
  website: string | null;
  menuUrl: string | null;
  hours: unknown;
  timezone: string | null;
  priceLevel: number | null;
  rating: number | null;
};

const placeSchema = z
  .object({
    id: z.string(),
    name: text,
    google_name: text,
    slug: text,
    category_label: text,
    category: text,
    profile_photo: text,
    photos: z.array(z.string()).catch([]),
    phone: text,
    address: text,
    pitch: text,
    website: text,
    menu_url: text,
    hours: z.unknown().optional(),
    timezone: text,
    price_level: number,
    google_stars_overall: number,
  })
  .transform(
    (row): Place => ({
      id: row.id,
      name: row.name ?? row.google_name ?? "",
      slug: row.slug ?? null,
      category: row.category_label ?? row.category ?? null,
      photo: row.profile_photo ?? row.photos[0] ?? null,
      phone: row.phone ?? null,
      address: row.address ?? null,
      pitch: row.pitch ?? null,
      website: row.website ?? null,
      menuUrl: row.menu_url ?? null,
      hours: row.hours,
      timezone: row.timezone ?? null,
      priceLevel: row.price_level ?? null,
      rating: row.google_stars_overall ?? null,
    }),
  );

/** One place. Null when the server says it is gone. Anything else throws. */
export async function getPlace(id: string, signal?: AbortSignal): Promise<Place | null> {
  try {
    const answer = await callEdge(
      "consumer-web-get-place",
      { id },
      z.object({ place: placeSchema }),
      { signal },
    );
    return answer.place;
  } catch (err) {
    if (err instanceof EdgeError && err.status === 404) return null;
    throw err;
  }
}

/** The reasons the web sheet offers, in its order. The keys are the server's. */
export const REPORT_REASONS = [
  { key: "closed", label: "Permanently closed" },
  { key: "wrong_info", label: "Wrong information" },
  { key: "wrong_links", label: "Wrong or broken link" },
  { key: "wrong_location", label: "Wrong location" },
  { key: "inappropriate_photos", label: "Inappropriate photos" },
  { key: "duplicate", label: "Duplicate place" },
  { key: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

export async function reportPlace(placeId: string, reason: ReportReason, note: string): Promise<void> {
  const trimmed = note.trim();
  await callEdge(
    "consumer-web-report-place",
    { place_id: placeId, reason, ...(trimmed ? { note: trimmed } : {}) },
    z.object({}),
    { mutation: true },
  );
}

const suggestionSchema = z.object({
  placeId: z.string(),
  mainText: z.string(),
  kind: z.string().nullish().catch(null),
});

/** Google places a member can add. Cities are left out: those set Search's centre. */
export async function suggestPlaces(input: string, sessionToken: string): Promise<{ placeId: string; mainText: string }[]> {
  const answer = await callEdge(
    "consumer-web-suggest-places",
    { input, sessionToken, mode: "fast" },
    z.object({ predictions: z.array(suggestionSchema) }),
  );
  return answer.predictions.filter((row) => row.kind !== "location");
}

export async function createPlace(googlePlaceId: string): Promise<{ id: string; name: string }> {
  const answer = await callEdge(
    "consumer-web-create-place",
    { googlePlaceId },
    z.object({ place: z.object({ id: z.string(), name: z.string().catch("") }) }),
    { mutation: true },
  );
  return answer.place;
}
