// Shared helper — place tag vocabulary (public.place_tags, migration
// 20260625060037_place_tags). Mirrors categories.ts: the list is config that
// lives in the DB, read live, never hardcoded. Both the admin Atlas vocabulary
// read (admin-web-get-atlas-fields) and the consumer detail enrichment
// (consumer-web-get-place) resolve slugs → labelled catalog entries through
// here, so a place's tags are always canonical catalog entries (snake_case
// slugs) and never free text. The business console has no tag picker EF of its
// own: business-web-list-tags was deleted unused in MESITA-1723.
//
// Locale contract (MESITA-963, parallel to MESITA-939 About):
//   - slug       = stable identity + future TMS key
//   - label_en   = Mesita core / default display language (source of truth)
//   - label_es   = dormant translation pack until a TMS lands — do NOT prefer
//                  it in consumer UI, and do NOT bind chips to
//                  mesita:pref:language yet (that pref still defaults to es).

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";

export { sanitizePlaceTags } from "./tags-sanitize.ts";

/** Mesita tags per place: the one cap every writer uses. */
export const MAX_PLACE_TAGS = ENRICH_FIELD_LIMITS.tagsPerPlace.max;

export type PlaceTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  sort_order: number;
};

// The 17 tag facets, in display order, with the emoji + bilingual group label
// the picker renders as section headers. Kept here (not in the DB) because it is
// pure presentation chrome; the canonical per-tag data lives in place_tags. The
// `slug` matches place_tags.facet exactly.
export type TagFacet = {
  slug: string;
  emoji: string;
  label_es: string;
  label_en: string;
};

export const TAG_FACETS: readonly TagFacet[] = [
  { slug: "payment", emoji: "💳", label_es: "Pago", label_en: "Payment" },
  { slug: "booking", emoji: "📅", label_es: "Reservas", label_en: "Booking" },
  { slug: "service", emoji: "🍽️", label_es: "Servicio", label_en: "Service" },
  { slug: "vibe", emoji: "✨", label_es: "Ambiente", label_en: "Vibe" },
  { slug: "occasion", emoji: "🎉", label_es: "Ideal para", label_en: "Good for" },
  { slug: "amenities", emoji: "🛋️", label_es: "Servicios", label_en: "Amenities" },
  { slug: "dietary", emoji: "🥗", label_es: "Dietético", label_en: "Dietary" },
  { slug: "menu", emoji: "🍳", label_es: "Menú", label_en: "Menu" },
  { slug: "drinks", emoji: "🍸", label_es: "Bar y bebidas", label_en: "Drinks" },
  { slug: "entertainment", emoji: "🎶", label_es: "Entretenimiento", label_en: "Entertainment" },
  { slug: "crowd", emoji: "👥", label_es: "Público", label_en: "Crowd" },
  { slug: "setting", emoji: "🌅", label_es: "Entorno", label_en: "Setting" },
  { slug: "hours", emoji: "🕒", label_es: "Horario", label_en: "Hours" },
  { slug: "dress", emoji: "👔", label_es: "Vestimenta", label_en: "Dress code" },
  { slug: "wellness", emoji: "🧘", label_es: "Bienestar", label_en: "Wellness" },
  { slug: "experiences", emoji: "🗺️", label_es: "Actividades", label_en: "Experiences" },
  { slug: "values", emoji: "🌱", label_es: "Valores", label_en: "Values" },
];

const TAG_COLUMNS = "slug, label_es, label_en, facet, sort_order";

// Reads the full, live tag vocabulary ordered by sort_order. Returns [] on
// error so callers degrade gracefully rather than failing over a tag lookup.
export async function fetchPlaceTags(
  client: SupabaseClient,
): Promise<PlaceTag[]> {
  const { data, error } = await client
    .from("place_tags")
    .select(TAG_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as PlaceTag[];
}

// Resolves an arbitrary list of tag slugs (e.g. places.tags) into ordered,
// labelled catalog entries. Unknown slugs are dropped; the result follows the
// catalog sort_order, not the input order. Returns [] for empty input without
// touching the DB.
export async function resolvePlaceTags(
  client: SupabaseClient,
  slugs: readonly string[] | null | undefined,
): Promise<PlaceTag[]> {
  if (!slugs || slugs.length === 0) return [];
  const { data, error } = await client
    .from("place_tags")
    .select(TAG_COLUMNS)
    .in("slug", slugs as string[])
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as PlaceTag[];
}

/**
 * Mesita tags from a model reply (MESITA-2790): slugs copied from the
 * place_tags vocabulary, lowercased, deduped, capped at tagsPerPlace.max.
 * Null when the reply carries no `tags` array — a failure that leaves the
 * stored tags alone. An empty array is a real answer and is written.
 */
export function pickVocabularyTags(
  raw: unknown,
  vocabulary: ReadonlySet<string>,
): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const t of raw) {
    const slug = typeof t === "string" ? t.trim().toLowerCase() : "";
    if (slug && vocabulary.has(slug) && !out.includes(slug)) out.push(slug);
    if (out.length === MAX_PLACE_TAGS) break;
  }
  return out;
}
