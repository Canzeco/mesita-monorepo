// Shared helper — place tag vocabulary (public.place_tags, migration
// 20260625060037_place_tags). Mirrors categories.ts: the list is config that
// lives in the DB, read live, never hardcoded. Both the business tag picker
// (business-web-list-tags) and the consumer detail enrichment (consumer-web-get-place)
// resolve slugs → labelled catalog entries through here, so a place's tags are
// always canonical catalog entries (snake_case slugs) and never free text.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { selectTopPlaceTags } from "./tags-sanitize.ts";

export { sanitizePlaceTags, selectTopPlaceTags } from "./tags-sanitize.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TAGGER_MODEL = "gpt-4o-mini";
const MAX_INFERRED_TAGS = ENRICH_FIELD_LIMITS.tagsPerPlace.max;

export type PlaceTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
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

const TAG_COLUMNS = "slug, label_es, label_en, facet, section, sort_order";

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

// Signals fed to the tag classifier (Enricher contents stage). All optional
// except name — the richer the material, the sharper the picks.
export type TagSignals = {
  name: string;
  category?: string | null;
  description?: string | null;
  googleReviewsText?: string | null;
  serpSummary?: string | null;
};

// Scores the full vocabulary and returns exactly the top MAX_INFERRED_TAGS
// conflict-free slugs that best match the place (or fewer only if the catalog
// itself is smaller). Returns [] when there's no OpenAI key, no vocabulary, or
// the model errors — tags are additive polish, never worth failing a run over.
// The vocabulary is passed in (the caller reads it once via fetchPlaceTags).
export async function inferPlaceTags(
  openaiKey: string | undefined,
  vocabulary: PlaceTag[],
  signals: TagSignals,
  model = DEFAULT_TAGGER_MODEL,
): Promise<string[]> {
  if (!openaiKey || vocabulary.length === 0) return [];
  const valid = new Set(vocabulary.map((t) => t.slug));
  const vocabText = vocabulary.map((t) => t.slug).join(", ");
  const placeLines = [
    `Name: ${signals.name}`,
    signals.category ? `Category: ${signals.category}` : "",
    signals.description ? `About: ${signals.description.slice(0, 1500)}` : "",
    signals.googleReviewsText ? `Reviews: ${signals.googleReviewsText.slice(0, 800)}` : "",
    signals.serpSummary ? `Editorial: ${signals.serpSummary}` : "",
  ].filter(Boolean).join("\n");

  const targetCount = Math.min(MAX_INFERRED_TAGS, vocabulary.length);
  const systemContent =
    "You tag a place using ONLY slugs from a fixed vocabulary. Score EVERY slug " +
    "in the vocabulary for how well it fits this place — do not skip weak matches " +
    "and do not stop early. Respond with a single JSON object " +
    "{\"tags\": [{\"slug\": \"<slug>\", \"score\": 0.0}, ...]}. Include every " +
    "vocabulary slug exactly once, copied verbatim, each with a confidence score " +
    "from 0 to 1 (1 = perfect fit, 0 = no fit). Return tags best-first by score. " +
    "Never invent a slug. Prefer the poles that fit when tags conflict: " +
    "reservations_required vs walk_ins_welcome vs accepts_reservations; " +
    "cash_only vs cards/contactless/meal_vouchers; quiet vs lively; casual vs upscale; " +
    "casual_dress vs formal_dress; adults_only vs family_friendly/families/kids_menu/" +
    "kids_activity/all_ages — give the fitting pole a high score and the opposite a low one.";
  const userPrompt =
    `Tag vocabulary (${vocabulary.length} slugs — score ALL of them):\n${vocabText}\n\n` +
    `Place:\n${placeLines}\n\n` +
    `Return {"tags": [{"slug": "<slug>", "score": 0.0-1.0}, ...]} with every vocabulary ` +
    `slug scored, ranked best-first. We will keep exactly the top ${targetCount} ` +
    `after conflict resolution — rank by true fit to this place.`;

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    let parsed: { tags?: unknown };
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "") as { tags?: unknown };
    } catch {
      return [];
    }
    if (!Array.isArray(parsed.tags)) return [];
    const candidates: { slug: string; score: number; index: number }[] = [];
    for (const [index, tag] of parsed.tags.entries()) {
      // Accept the legacy string shape during rollout; scores rank new responses above it.
      const slug = typeof tag === "string"
        ? tag.trim()
        : typeof tag === "object" && tag !== null && "slug" in tag &&
            typeof tag.slug === "string" && "score" in tag &&
            typeof tag.score === "number" && Number.isFinite(tag.score) &&
            tag.score >= 0 && tag.score <= 1
          ? tag.slug.trim()
          : "";
      const score = typeof tag === "object" && tag !== null && "score" in tag &&
          typeof tag.score === "number"
        ? tag.score
        : 0;
      if (slug && valid.has(slug)) candidates.push({ slug, score, index });
    }
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    const seen = new Set<string>();
    const ranked: string[] = [];
    for (const { slug } of candidates) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      ranked.push(slug);
    }
    // Any vocabulary slug the model omitted is treated as score 0 (catalog order)
    // so we can always fill to exactly targetCount after conflict sanitization.
    for (const tag of vocabulary) {
      if (seen.has(tag.slug)) continue;
      seen.add(tag.slug);
      ranked.push(tag.slug);
    }
    return selectTopPlaceTags(ranked, targetCount);
  } catch {
    return [];
  }
}
