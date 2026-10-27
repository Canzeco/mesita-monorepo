// The one enrichment commit fills the Presentation and the Mesita tags
// (MESITA-2836: the Description step writes only Mesita fields), and hands back the Mesita Name the same synthesis inferred,
// which lands only through _shared/mesita-name-door.ts (MESITA-2790: every
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
 * it failed (null). Google categories and families are never written here:
 * the trigger derives the categories from Google's own types (MESITA-2836)
 * and the profiles view the families (MESITA-2834).
 */
export function mergeSynthesizedProfile(opts: {
  patch: Record<string, unknown>;
  presentation: string | null;
  tags: string[] | null;
}): Record<string, unknown> {
  const next = { ...opts.patch };
  const presentation = opts.presentation ? capPresentation(opts.presentation) : "";
  if (presentation) {
    next.description = presentation;
  }
  if (opts.tags) next.tags = opts.tags;
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

export type FilledProfile = {
  patch: Record<string, unknown>;
  /** The synthesis's clean display name, for the Mesita Name door. */
  mesitaName: string | null;
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
    return { patch, mesitaName: null };
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
  if (!openaiKey) return { patch, mesitaName: null };

  const [tagVocabulary, cfg] = await Promise.all([
    fetchPlaceTags(admin),
    loadEnrichConfig(admin),
  ]);
  const name = textField(patch.google_name) || textField(patch.mesita_name);
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
    }
  }
  if (!presentation && googleSummary) presentation = capPresentation(googleSummary);
  if (!tags) console.warn(`[enrich] ${placeId}: Mesita tags not inferred; stored tags kept`);


  return {
    patch: mergeSynthesizedProfile({
      patch,
      presentation,
      tags,
    }),
    mesitaName,
  };
}
