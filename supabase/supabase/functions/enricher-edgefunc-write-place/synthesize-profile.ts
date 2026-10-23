// The one enrichment commit fills the Presentation, one Category, and Tags,
// and hands back the Mesita Name the same synthesis inferred, which lands
// only through _shared/mesita-name-door.ts. The classifiers already live in
// _shared. This module only decides which of those results may land, then
// the write commits them with the rest. The Scout's read, when Strong bought
// one, is the SERP slot; Google's own summary is the fallback.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchPlaceCategories } from "../_shared/categories.ts";
import { inferPlaceCategory } from "../_shared/categories-infer.ts";
import { loadEnrichConfig } from "../_shared/enrich-config.ts";
import {
  applyProfileToUpdate,
  synthesizeProfile,
  synthesisModelFor,
} from "../_shared/enrich-synthesis.ts";
import { humanizeCategorySlug } from "../_shared/parse-utils.ts";
import { findAddressComponent } from "../_shared/enrich-google-basics-normalizers.ts";
import { keepAtlasValues } from "../_shared/place-taxonomy.ts";
import { fetchPlaceTags, inferPlaceTags } from "../_shared/tags.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";

// The one sentence-safe cap (MESITA-2641); re-exported for this EF's callers
// and its test.
export { capPresentation } from "../_shared/presentation-cap.ts";
import { capPresentation } from "../_shared/presentation-cap.ts";
import { mesitaCategoriesLocked } from "../_shared/mesita-categories-at-create.ts";

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

function filled(value: unknown): boolean {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 && text !== "undefined";
  }
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function slugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/** Fields already on the patch stay when Overwrite is off. Empty ones take the new values. */
export function mergeSynthesizedProfile(opts: {
  overwrite: boolean;
  patch: Record<string, unknown>;
  presentation: string | null;
  category: string | null;
  tags: string[];
}): Record<string, unknown> {
  const next = { ...opts.patch };
  const presentation = opts.presentation ? capPresentation(opts.presentation) : "";
  if (presentation && (opts.overwrite || !filled(opts.patch.description))) {
    next.description = presentation;
  }
  const categoriesLocked = mesitaCategoriesLocked(opts.patch);
  if (
    opts.category && opts.category !== "undefined" && !categoriesLocked &&
    (opts.overwrite || !filled(opts.patch.category))
  ) {
    next.category = opts.category;
    next.category_label = humanizeCategorySlug(opts.category);
  }
  if (opts.tags.length === 0) return next;
  if (opts.overwrite || !filled(opts.patch.tags)) {
    next.tags = opts.tags;
    return next;
  }
  next.tags = [...new Set([...slugs(opts.patch.tags), ...opts.tags])];
  return next;
}

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Zone and city for the franchise rule: the saved value, else Google's
 *  structured address on the same patch, the way Create derives them. */
export function branchAnchor(patch: Record<string, unknown>): { zone: string | null; city: string | null } {
  const address = patch.google_address;
  const components = address && typeof address === "object" && !Array.isArray(address)
    ? (address as { addressComponents?: unknown }).addressComponents
    : undefined;
  const list = Array.isArray(components) ? components as { types?: string[]; longText?: string }[] : undefined;
  return {
    zone: textField(patch.zone) || findAddressComponent(list, ["neighborhood", "sublocality_level_1", "sublocality"]),
    city: textField(patch.city) || findAddressComponent(list, ["locality", "administrative_area_level_2"]),
  };
}

function overwriteOn(patch: Record<string, unknown>): boolean {
  const sync = patch.source_sync;
  if (!sync || typeof sync !== "object" || Array.isArray(sync)) return false;
  return (sync as { overwrite?: unknown }).overwrite === true;
}

export type FilledProfile = {
  patch: Record<string, unknown>;
  /** The synthesis's clean display name, for the Mesita Name door. */
  mesitaName: string | null;
};

/**
 * Asks the existing classifiers for a Presentation, one Category, and Tags.
 * A model failure leaves the patch unchanged. The caller still commits once.
 */
export async function fillAtlasProfile(
  admin: SupabaseClient,
  placeId: string,
  patch: Record<string, unknown>,
  grounding: { serpSummary: string | null } = { serpSummary: null },
): Promise<FilledProfile> {
  try {
    return await fillAtlasProfileInner(admin, placeId, patch, grounding);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] profile synthesis skipped: ${why}`);
    return { patch, mesitaName: null };
  }
}

async function fillAtlasProfileInner(
  admin: SupabaseClient,
  _placeId: string,
  patch: Record<string, unknown>,
  grounding: { serpSummary: string | null },
): Promise<FilledProfile> {
  const openaiKey = Deno.env.get("OPENAI_KEY")?.trim() ?? "";
  if (!openaiKey) return { patch, mesitaName: null };

  const [categories, tagVocabulary, models, cfg] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceTags(admin),
    loadModelsConfig(admin),
    loadEnrichConfig(admin),
  ]);
  const name = textField(patch.google_name) || textField(patch.mesita_name);
  const address = textField(patch.address);
  const googleSummary = textField(patch.pitch) || textField(patch.story) || textField(patch.description);
  const webRead = textField(grounding.serpSummary) || googleSummary;
  const reviews = reviewQuotes(patch.google_reviews);

  let presentation: string | null = null;
  let mesitaName: string | null = null;
  const anchor = branchAnchor(patch);
  if (name) {
    const { parsed } = await synthesizeProfile({
      openaiKey,
      model: synthesisModelFor(cfg.synthesisQuality),
      name,
      locationLine: address,
      category: textField(patch.category) || null,
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
    }
  }
  if (!presentation && googleSummary) presentation = capPresentation(googleSummary);

  const category = mesitaCategoriesLocked(patch)
    ? null
    : await inferPlaceCategory(openaiKey, categories, {
      name: name || "Place",
      address,
      googlePrimaryType: textField(patch.google_primary_type) || textField(patch.category) || null,
      googleTypes: slugs(patch.google_types),
      editorialSummary: googleSummary || null,
      description: presentation,
    }, models.enricherModel);
  const inferredTags = await inferPlaceTags(openaiKey, tagVocabulary, {
    name: name || "Place",
    category,
    description: presentation,
    googleReviewsText: reviews,
    serpSummary: webRead || null,
  }, models.enricherModel);
  const kept = keepAtlasValues({
    category,
    tags: inferredTags,
    categories: categories.map((item) => item.slug),
    tagVocabulary: tagVocabulary.map((item) => item.slug),
  });

  return {
    patch: mergeSynthesizedProfile({
      overwrite: overwriteOn(patch),
      patch,
      presentation,
      category: kept.category,
      tags: kept.tags,
    }),
    mesitaName,
  };
}
