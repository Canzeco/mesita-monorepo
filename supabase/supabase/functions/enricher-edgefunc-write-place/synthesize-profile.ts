// The one enrichment commit fills the Presentation and the Mesita tags
// (MESITA-2836: the Description step writes only Mesita fields), and hands back the Mesita Name the same synthesis inferred,
// which lands only through _shared/place-name-door.ts (MESITA-2790: every
// Mesita field is inferred on every Enrich). The classifiers live in _shared.
// This module only decides which of those results may land, then the write
// commits them with the rest. The Scout's read, when the run bought one, is the
// SERP slot; Google's own summary is the fallback.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { loadEnrichConfig } from "../_shared/enrich-config.ts";
import {
  applyProfileToUpdate,
  synthesizeProfile,
  synthesisModelFor,
} from "../_shared/enrich-synthesis.ts";
import { findAddressComponent } from "../_shared/enrich-google-basics-normalizers.ts";

// The one sentence-safe cap (MESITA-2641); re-exported for this EF's callers
// and its test.
export { capPresentation } from "../_shared/presentation-cap.ts";
import { capPresentation } from "../_shared/presentation-cap.ts";
import { fetchPlaceTags, pickVocabularyTags } from "../_shared/tags.ts";
import { fetchPlaceFamilies } from "../_shared/categories.ts";
import {
  familiesToStore,
  familyVocabularyLines,
  isGoogleCategoryEnabled,
  mainGoogleCategory,
  pickFamilies,
} from "../_shared/families-infer.ts";
import { pickZone } from "../_shared/zone-infer.ts";

export function reviewQuotes(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const lines: string[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const quote = (row as { quote?: unknown }).quote;
    if (typeof quote !== "string") continue;
    const text = quote.trim();
    if (!text) continue;
    lines.push(text);
    if (lines.length === 8) break;
  }
  return lines.join("\n");
}

function slugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/**
 * What this run's inferences add to the patch. Every Enrich replaces the
 * Presentation with the one it wrote (MESITA-2799: one Enrich, no Overwrite
 * switch); an empty synthesis leaves the saved text alone. Tags are
 * re-inferred every run: written when the call succeeded, left as stored when
 * it failed (null). Google categories are never written here: the trigger
 * derives them from Google's own types (MESITA-2836). Families ride out as
 * `families` and index.ts writes them on place_profiles (MESITA-2891), unless
 * the operator owns them (MESITA-2893).
 */
export function mergeSynthesizedProfile(opts: {
  patch: Record<string, unknown>;
  presentation: string | null;
  tags: string[] | null;
  /** Mesita Zone (MESITA-2937): written when inferred, else the stored one stays. */
  zone?: string | null;
}): Record<string, unknown> {
  const next = { ...opts.patch };
  const presentation = opts.presentation ? capPresentation(opts.presentation) : "";
  if (presentation) {
    next.description = presentation;
  }
  if (opts.tags) next.tags = opts.tags;
  if (opts.zone) next.zone = opts.zone;
  return next;
}

/** The saved row's Google and Mesita signals; Render's patch carries none. */
export type SavedSignals = {
  /** Google's own types (MESITA-2827), the synthesis's grounding. */
  google_source_types?: unknown;
  google_types?: unknown;
  google_tags?: unknown;
  category?: unknown;
};

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Zone and city for the franchise rule and the Mesita Zone's hint: Google's
 *  structured address on the same patch, else the saved value. Google's
 *  neighborhood leads so the stored (inferred) zone never feeds itself. */
export function branchAnchor(patch: Record<string, unknown>): { zone: string | null; city: string | null } {
  const address = patch.google_address;
  const components = address && typeof address === "object" && !Array.isArray(address)
    ? (address as { addressComponents?: unknown }).addressComponents
    : undefined;
  const list = Array.isArray(components) ? components as { types?: string[]; longText?: string }[] : undefined;
  return {
    zone: findAddressComponent(list, ["neighborhood", "sublocality_level_1", "sublocality"]) || textField(patch.zone) || null,
    city: textField(patch.city) || findAddressComponent(list, ["locality", "administrative_area_level_2"]),
  };
}

export type FilledProfile = {
  patch: Record<string, unknown>;
  /** The synthesis's clean display name, for the Mesita Name door. */
  mesitaName: string | null;
  /**
   * Mesita Families to store on place_profiles (MESITA-2891): 1–5 slugs, null
   * for a not-enabled main Google category, undefined to keep the stored list.
   */
  families?: string[] | null;
};

/**
 * Asks the synthesis for a Presentation, the Mesita name and the Mesita tags
 * (MESITA-2836: the Description step writes the three Mesita fields and
 * nothing of Google's).
 * A model failure leaves the patch unchanged. The caller still commits once.
 */
export async function fillAtlasProfile(
  admin: SupabaseClient,
  placeId: string,
  patch: Record<string, unknown>,
  grounding: { serpSummary: string | null } = { serpSummary: null },
  saved: SavedSignals = {},
): Promise<FilledProfile> {
  try {
    return await fillAtlasProfileInner(admin, placeId, patch, grounding, saved);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] profile synthesis skipped: ${why}`);
    return { patch, mesitaName: null, families: undefined };
  }
}

async function fillAtlasProfileInner(
  admin: SupabaseClient,
  placeId: string,
  patch: Record<string, unknown>,
  grounding: { serpSummary: string | null },
  saved: SavedSignals,
): Promise<FilledProfile> {
  const openaiKey = Deno.env.get("OPENAI_KEY")?.trim() ?? "";
  if (!openaiKey) return { patch, mesitaName: null, families: undefined };

  const [tagVocabulary, cfg, familyVocabulary, enabled] = await Promise.all([
    fetchPlaceTags(admin),
    loadEnrichConfig(admin),
    fetchPlaceFamilies(admin),
    isGoogleCategoryEnabled(admin, mainGoogleCategory(saved.google_types, saved.category)),
  ]);
  const name = textField(patch.google_name) || textField(patch.name);
  const address = textField(patch.address);
  const googleSummary = textField(patch.pitch) || textField(patch.story) || textField(patch.description);
  const webRead = textField(grounding.serpSummary) || googleSummary;
  const reviews = reviewQuotes(patch.google_reviews);
  // Render's patch carries no Google categories, attributes or category:
  // read them off the saved row. Google's own types feed the synthesis;
  // a row from before google_source_types falls back to its categories.
  const sourceTypes = slugs(saved.google_source_types);
  const googleTypes = sourceTypes.length > 0 ? sourceTypes : slugs(saved.google_types);
  const googleTags = slugs(saved.google_tags);
  const tagSlugs = new Set(tagVocabulary.map((t) => t.slug));

  let presentation: string | null = null;
  let mesitaName: string | null = null;
  let tags: string[] | null = null;
  let pickedFamilies: string[] | null = null;
  let zone: string | null = null;
  const anchor = branchAnchor(patch);
  if (name) {
    const { parsed } = await synthesizeProfile({
      openaiKey,
      model: synthesisModelFor(cfg.synthesisQuality),
      name,
      locationLine: address,
      category: textField(saved.category) || null,
      googleTypes,
      googleTags,
      tagVocabulary: [...tagSlugs],
      familyVocabulary: enabled ? familyVocabularyLines(familyVocabulary) : [],
      // The franchise rule's anchor: a chain branch is named brand + zone.
      zone: anchor.zone,
      city: anchor.city,
      igBio: "",
      googleReviewsText: reviews,
      serpSummary: webRead || null,
    });
    if (parsed) {
      const drafted: Record<string, unknown> = {};
      applyProfileToUpdate(drafted, parsed);
      presentation = textField(drafted.description) || null;
      mesitaName = textField(parsed.mesita_name) || null;
      tags = pickVocabularyTags(parsed.tags, tagSlugs);
      pickedFamilies = pickFamilies(parsed.families, familyVocabulary);
      zone = pickZone(parsed.zone, anchor.city);
    }
  }
  const families = familiesToStore(pickedFamilies, enabled);
  if (families === undefined) {
    console.warn(`[enrich] ${placeId}: Mesita families not inferred; stored families kept`);
  }
  if (!presentation && googleSummary) presentation = capPresentation(googleSummary);
  if (!tags) console.warn(`[enrich] ${placeId}: Mesita tags not inferred; stored tags kept`);
  if (!zone) console.warn(`[enrich] ${placeId}: Mesita Zone not inferred; stored zone kept`);


  return {
    patch: mergeSynthesizedProfile({
      patch,
      presentation,
      tags,
      zone,
    }),
    mesitaName,
    families,
  };
}
