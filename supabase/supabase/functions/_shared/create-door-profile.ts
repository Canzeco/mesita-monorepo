// The CREATE-door Description (§8.4 v3, gate D1) — function 4 of the Create
// run. ONE batched prompt infers all Description fields from the thin
// Google-basics signals (name, address, zone/city, types, editorial summary),
// so the door costs one LLM call, not five. Runs ONLY when the create does not
// queue a full Enrich (business creates queue; the Enricher's step 7
// redoes this properly minutes later with rich grounding).
//
// Mesita tags are validated against the live catalog and stored (MESITA-2790).
// Mesita Families (1–5) come from the same call (MESITA-2891), unless the
// main Google category is not enabled on Mesita. Google categories are
// Google's own types (MESITA-2836): nothing here infers them.
// Mesita Name is returned as a CANDIDATE — only the mesita-name-door may
// land it (gate D2).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchPlaceTags, MAX_PLACE_TAGS, pickVocabularyTags } from "./tags.ts";
import {
  formatDescriptionParagraphs,
} from "./enrich-synthesis-profile.ts";
import { OPENAI_URL } from "./enrich-config.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { capPresentation } from "./presentation-cap.ts";
import { loadModelsConfig } from "./models-config.ts";
import { reservationsLikelyFromInference } from "./infer-place-reservations.ts";
import { fetchPlaceFamilies } from "./categories.ts";
import {
  FAMILIES_RULE,
  familiesToStore,
  familyVocabularyLines,
  isGoogleCategoryEnabled,
  mainGoogleCategory,
  pickFamilies,
} from "./families-infer.ts";

export type DoorProfile = {
  /** Null when the reply carried no tags array: Create then writes none. */
  tags: string[] | null;
  /** Mesita Families to store (MESITA-2891): see familiesToStore. */
  families: string[] | null | undefined;
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

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function synthesizeDoorProfile(
  admin: SupabaseClient,
  openaiKey: string,
  signals: DoorSignals,
): Promise<DoorProfile | null> {
  const [tagVocab, models, familyVocab, enabled] = await Promise.all([
    fetchPlaceTags(admin),
    loadModelsConfig(admin),
    fetchPlaceFamilies(admin),
    isGoogleCategoryEnabled(admin, mainGoogleCategory(signals.googleTypes, null)),
  ]);
  const familyLines = enabled ? familyVocabularyLines(familyVocab) : [];
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
    '{"tags":["<0-' + String(MAX_PLACE_TAGS) + ' slugs from the tag list>"],' +
    '"presentation":"<2-3 short English paragraphs separated by \\n\\n>",' +
    '"reservations_likely":<boolean>,' +
    '"mesita_name":"<clean display name, proper case; null when the given ' +
    'name already follows the MESITA NAME rule below>",' +
    '"semantic_summary":"<one dense English paragraph (~60-90 words) of what ' +
    'this place IS, for semantic search — no marketing voice>",' +
    '"families":["<1-5 slugs from the family list>"]}. ' +
    FAMILIES_RULE + " " +
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
    `Tags:\n${tagVocab.map((t) => t.slug).join(", ")}\n\n` +
    (familyLines.length ? `Families (FAMILY LIST):\n${familyLines.join("\n")}\n\n` : "") +
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

    const tags = pickVocabularyTags(parsed.tags, tagSlugs);
    const description = (() => {
      const d = str(parsed.presentation);
      return d
        ? capPresentation(formatDescriptionParagraphs(d))
        : null;
    })();
    const nameMax = ENRICH_FIELD_LIMITS.placeName?.max ?? 80;
    return {
      tags,
      families: familiesToStore(pickFamilies(parsed.families, familyVocab), enabled),
      description,
      reservationsLikely: reservationsLikelyFromInference(parsed),
      mesitaNameCandidate: str(parsed.mesita_name)?.slice(0, nameMax) ?? null,
      semanticSummary: str(parsed.semantic_summary)?.slice(0, SUMMARY_MAX) ??
        null,
    };
  } catch {
    return null;
  }
}
