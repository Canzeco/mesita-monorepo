// The CREATE-door Description (§8.4 v3, gate D1) — function 4 of the Create
// run. ONE batched prompt infers all Description fields from the thin
// Google-basics signals (name, address, zone/city, types, editorial summary),
// so the door costs one LLM call, not five. Runs ONLY when the create does not
// queue a full Enrich (business creates queue; the Intaker's function 9
// redoes this properly minutes later with rich grounding).
//
// Every output is validated against the LIVE vocabularies exactly like the
// enrich-time classifiers: category must be a live slug, supers resolve
// through the multi-parent membership law, tags filter to the catalog.
// Mesita Name is returned as a CANDIDATE — only the mesita-name-door may
// land it (gate D2).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  fetchPlaceCategories,
  fetchPlaceSuperCategories,
} from "./categories.ts";
import { fetchPlaceTags } from "./tags.ts";
import { resolveEnrichedFamilyKeys } from "./place-taxonomy.ts";
import {
  formatDescriptionParagraphs,
} from "./enrich-synthesis-profile.ts";
import { ENRICH_DESCRIPTION_MAX, OPENAI_URL } from "./enrich-config.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { loadModelsConfig } from "./models-config.ts";

export type DoorProfile = {
  category: string | null;
  familyKeys: string[];
  tags: string[];
  description: string | null;
  reservationsLikely: boolean;
  mesitaNameCandidate: string | null;
  semanticSummary: string | null;
};

export type DoorSignals = {
  name: string;
  address?: string | null;
  // The branch anchor for the FRANCHISE RULE: zone is the colonia /
  // neighborhood, city the fallback. Both ride in from the Google spine
  // `fetchGoogleBasics` just resolved, so the door never has to guess.
  zone?: string | null;
  city?: string | null;
  googleTypes?: string[] | null;
  editorialSummary?: string | null;
  priceLevel?: number | null;
};

const SUMMARY_MAX = 700;
const MAX_INFERRED_TAGS = 20;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function synthesizeDoorProfile(
  admin: SupabaseClient,
  openaiKey: string,
  signals: DoorSignals,
): Promise<DoorProfile | null> {
  const [categories, supers, tagVocab, models] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceSuperCategories(admin),
    fetchPlaceTags(admin),
    loadModelsConfig(admin),
  ]);
  if (categories.length === 0 || supers.length === 0) return null;

  const realCategories = categories.filter((c) => c.slug !== "undefined");
  const realSupers = supers.filter((s) => s.slug !== "undefined");
  const categorySlugs = new Set(realCategories.map((c) => c.slug));
  const tagSlugs = new Set(tagVocab.map((t) => t.slug));

  const placeLines = [
    `Name: ${signals.name}`,
    signals.address ? `Address: ${signals.address}` : "",
    signals.zone ? `Neighborhood / zone: ${signals.zone}` : "",
    signals.city ? `City: ${signals.city}` : "",
    signals.googleTypes?.length
      ? `Google types: ${signals.googleTypes.join(", ")}`
      : "",
    signals.editorialSummary ? `Summary: ${signals.editorialSummary}` : "",
    typeof signals.priceLevel === "number"
      ? `Price level: ${signals.priceLevel}`
      : "",
  ].filter(Boolean).join("\n");

  const systemContent =
    "You are Mesita's create-door profiler. From the thin Google signals " +
    "provided, return ONE JSON object with EXACTLY these keys: " +
    '{"category":"<slug from the category list>",' +
    '"super_categories":["<1-2 slugs from the super list>"],' +
    '"tags":["<0-' + String(MAX_INFERRED_TAGS) + ' slugs from the tag list>"],' +
    '"presentation":"<2-3 short English paragraphs separated by \\n\\n>",' +
    '"reservations_likely":<boolean>,' +
    '"mesita_name":"<clean display name, proper case; null when the given ' +
    'name already follows the MESITA NAME rule below>",' +
    '"semantic_summary":"<one dense English paragraph (~60-90 words) of what ' +
    'this place IS, for semantic search — no marketing voice>"}. ' +
    "MESITA NAME: strip slogans, legal forms (S.A. de C.V., LLC, Inc.), " +
    "store numbers and internal branch codes. FRANCHISE RULE — a chain " +
    "branch is named BRAND + WHERE IT IS. When the place is one location of " +
    "a franchise or chain (a brand with many branches: Starbucks, Tim " +
    "Hortons, Domino's, Carl's Jr.), the bare brand is NOT a usable name, " +
    "because every branch in the city would read identically. Keep the " +
    'locating qualifier the given name already carries, or append the ' +
    'neighborhood/zone from the Place block when it carries none ' +
    '("Starbucks" in Polanco -> "Starbucks Polanco"); use the city only ' +
    "when no zone is given, and never invent a branch or a location the " +
    "Place block does not show. An INDEPENDENT place — one location, not a " +
    "chain — is NOT a franchise: never bolt a zone onto it. " +
    "Slugs are copied VERBATIM from the lists. English only. No invented " +
    "facts, ratings, or prices — thin sources mean shorter honest text.";
  const userPrompt =
    `Categories:\n${realCategories.map((c) => c.slug).join(", ")}\n\n` +
    `Super Categories:\n${realSupers.map((s) => s.slug).join(", ")}\n\n` +
    `Tags:\n${tagVocab.map((t) => t.slug).join(", ")}\n\n` +
    `Place:\n${placeLines}`;

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: models.enricherModel || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "") as Record<
        string,
        unknown
      >;
    } catch {
      return null;
    }

    const category = (() => {
      const c = str(parsed.category)?.toLowerCase() ?? null;
      return c && categorySlugs.has(c) ? c : null;
    })();
    const familyKeys = resolveEnrichedFamilyKeys(
      category,
      Array.isArray(parsed.super_categories) ? parsed.super_categories : [],
    );
    const tags = (Array.isArray(parsed.tags) ? parsed.tags : [])
      .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
      .filter((t) => tagSlugs.has(t))
      .slice(0, MAX_INFERRED_TAGS);
    const description = (() => {
      const d = str(parsed.presentation);
      return d
        ? formatDescriptionParagraphs(d).slice(0, ENRICH_DESCRIPTION_MAX)
        : null;
    })();
    const nameMax = ENRICH_FIELD_LIMITS.placeName?.max ?? 80;
    return {
      category,
      familyKeys,
      tags,
      description,
      reservationsLikely: parsed.reservations_likely === true,
      mesitaNameCandidate: str(parsed.mesita_name)?.slice(0, nameMax) ?? null,
      semanticSummary: str(parsed.semantic_summary)?.slice(0, SUMMARY_MAX) ??
        null,
    };
  } catch {
    return null;
  }
}
