// Atlas synthesis — the "Research Backbone". Reads ONLY the gathered source
// material (Instagram bio, Google reviews, SERP editorial blurb) — no web
// access, so it can't drift — and compiles the canonical place profile JSON.
// The website is no longer scraped, so there is no menu source: products.menu
// is not synthesised. Model comes from the admin 'synthesis quality' param.

import {
  ENRICH_DESCRIPTION_MAX,
  ENRICH_DESCRIPTION_TARGET_CHARS,
  ENRICH_DESCRIPTION_TARGET_WORDS,
  openaiChat,
  QUALITY_MODEL,
} from "./enrich-config.ts";
import { MAX_PLACE_TAGS } from "./tags.ts";
import { FAMILIES_RULE } from "./families-infer.ts";
import { ZONE_RULE } from "./zone-infer.ts";
import {
  type ProfileResult,
} from "./enrich-synthesis-profile.ts";

export {
  applyProfileToUpdate,
  asProfileText,
  formatDescriptionParagraphs,
  type ProfileResult,
} from "./enrich-synthesis-profile.ts";

const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    // A classifier INPUT only (category / families / reservations read it in
    // the contents stage); never written onto the place (MESITA-2144).
    editorial_summary: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    mesita_name: { type: ["string", "null"] },
    // Mesita tags (MESITA-2790): slugs copied from the TAG VOCABULARY block.
    tags: { type: "array", items: { type: "string" } },
    // Mesita Families (MESITA-2891): 1–5 slugs from the FAMILY LIST block.
    families: { type: "array", items: { type: "string" } },
    // Mesita Zone (MESITA-2937): the neighborhood the place header draws.
    zone: { type: ["string", "null"] },
    // No popular_times (MESITA-2420): a guess from review text is not
    // Google's busy hours, and the guest card says "From Google".
  },
} as const;

// Resolve the synthesis model from the admin quality knob.
export function synthesisModelFor(quality: string): string {
  return QUALITY_MODEL[quality] ?? "gpt-4o-mini";
}

// Compile the place profile from gathered material. Returns the parsed profile
// (or null) plus a diagnostic for enrichment_sources.synthesis.
export async function synthesizeProfile(input: {
  openaiKey: string;
  model: string;
  name: string;
  locationLine: string;
  category: string | null;
  /** Google's own categories, primary first, and atmosphere attributes. */
  googleTypes?: string[];
  googleTags?: string[];
  /** place_tags slugs the model may pick Mesita tags from. */
  tagVocabulary?: string[];
  /** `slug — Label` lines the model may pick Mesita Families from (MESITA-2891). */
  familyVocabulary?: string[];
  // The branch anchor for the FRANCHISE RULE below, and the hint the Mesita
  // Zone is read from (MESITA-2937): zone is Google's colonia / neighborhood
  // when it names one, city the fallback.
  zone?: string | null;
  city?: string | null;
  igBio: string;
  googleReviewsText: string;
  // P2 (SERP) web-grounded editorial color — SOFT context only, never
  // authoritative. Labelled as such in the grounding block so synthesis treats
  // it as background, not as a source of facts/ratings/prices.
  serpSummary?: string | null;
}): Promise<{ parsed: ProfileResult | null; diag: Record<string, unknown> }> {
  const {
    openaiKey, model, name, locationLine, category, zone, city, igBio,
    googleReviewsText, serpSummary, googleTypes, googleTags, tagVocabulary,
    familyVocabulary,
  } = input;

  // Where this branch actually is — the qualifier the franchise rule spends.
  const branchAnchor = [
    zone ? `Neighborhood / zone: ${zone}` : "",
    city ? `City: ${city}` : "",
  ].filter(Boolean).join(" · ");

  const grounding = [
    googleTypes && googleTypes.length ? `Google categories: ${googleTypes.join(", ")}` : "",
    googleTags && googleTags.length ? `Google attributes: ${googleTags.join(", ")}` : "",
    igBio ? `Instagram bio: ${igBio}` : "",
    googleReviewsText ? `Google reviews (sample):\n${googleReviewsText}` : "",
    serpSummary
      ? `Web editorial color (SOFT context — background only, NOT authoritative; do not treat as a source of facts, ratings, or prices):\n${serpSummary}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = buildPresentationInput({
    name,
    locationLine,
    category,
    branchAnchor,
    grounding,
    tagVocabulary: tagVocabulary ?? [],
    familyVocabulary: familyVocabulary ?? [],
  });

  const systemContent = PRESENTATION_INSTRUCTIONS;

  const res = await openaiChat({
    key: openaiKey,
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userPrompt },
    ],
    json: true,
  });
  if (res.ok) {
    const parsed = res.parsed as ProfileResult | null;
    return { parsed, diag: { provider: "openai", model, ok: !!parsed } };
  }
  if (res.status !== null) {
    return { parsed: null, diag: { provider: "openai", model, ok: false, status: res.status } };
  }
  return { parsed: null, diag: { provider: "openai", model, ok: false } };
}

// Exported so admin Crenup can RENDER it (crenup-prompts.ts → the console). The
// console shows this exact constant, so what an operator reads is what the
// vendor receives — a second copy could drift, this cannot.
export const PRESENTATION_INSTRUCTIONS =
  "You are Mesita's place-intelligence synthesis agent. Use ONLY the source " +
  "material the user provides — do not browse or use outside knowledge. " +
  "Mesita's core language is English: all prose fields are English. " +
  "Output a SINGLE valid JSON object (no prose, no markdown fences) matching " +
  "this shape, using null or [] when the sources don't support a field: " +
  JSON.stringify(PROFILE_SCHEMA.properties) +
  " Text fields (editorial_summary, description) " +
  "are single JSON strings — never arrays or nested objects. " +
  "For description: separate paragraphs with blank lines " +
  "(\\n\\n); never one continuous block. Never invent ratings, reviewer " +
  "quotes, prices, or a chef's name.";

// The per-place message. Pure and exported so crenup-prompts.ts can render the
// REAL template with sentinel values — the console never re-types this prose.
export function buildPresentationInput(place: {
  name: string;
  locationLine: string;
  category: string | null;
  branchAnchor: string;
  grounding: string;
  tagVocabulary?: string[];
  familyVocabulary?: string[];
}): string {
  const { name, locationLine, category, branchAnchor, grounding } = place;
  const vocabulary = place.tagVocabulary ?? [];
  const familyLines = place.familyVocabulary ?? [];
  return (
    `Compile the public profile of the place "${name}"` +
    (locationLine ? ` located at ${locationLine}` : "") +
    (category ? ` (category: ${category})` : "") +
    `, using ONLY the source material below. Return a single JSON object ` +
    `matching the schema. ` +
    `LANGUAGE (HARD RULE — Mesita core is English): "description", ` +
    `"editorial_summary", and every other prose field MUST be written in ` +
    `English, even when the source material is Spanish. Translate facts ` +
    `into English; do not leave Spanish prose in any field. ` +
    `Write "description" as the public Presentation for the Place page: ` +
    `an inviting, factual narrative of about ` +
    `${ENRICH_DESCRIPTION_TARGET_CHARS} characters (roughly ` +
    `${ENRICH_DESCRIPTION_TARGET_WORDS} words), never more than ` +
    `${ENRICH_DESCRIPTION_MAX} characters. ` +
    `CRITICAL — paragraphs: "description" MUST be several paragraphs ` +
    `separated by a blank line (the two-character sequence \\n\\n). Never ` +
    `return one unbroken wall of text. Aim for 3–4 paragraphs; each ` +
    `paragraph is 2–4 sentences on one idea (atmosphere, cuisine, signature ` +
    `dishes or experiences, history or neighborhood, why visit) — only when ` +
    `the sources support it. Write shorter only when the sources cannot ` +
    `fill that length; never pad with filler or invented detail. ` +
    `"mesita_name" is the clean public display name, in proper case: strip ` +
    `slogans, legal forms (S.A. de C.V., LLC, Inc.), store numbers and ` +
    `internal branch codes. ` +
    `FRANCHISE RULE — a chain branch is named BRAND + WHERE IT IS. When the ` +
    `place is one location of a franchise or chain (a brand with many ` +
    `branches: Starbucks, Tim Hortons, Domino's, Carl's Jr.), the bare brand ` +
    `is NOT a usable name — every branch in the city would read identically. ` +
    `Keep the locating qualifier the given name already carries, or append ` +
    `the neighborhood/zone from the LOCATION ANCHOR below when it carries ` +
    `none: "Starbucks" in Polanco → "Starbucks Polanco"; "Tim Hortons TEC ` +
    `Campus" stays "Tim Hortons TEC Campus". Use the city only when no zone ` +
    `is given, and never invent a branch or a location the anchor does not ` +
    `show. An INDEPENDENT place — one location, not a chain — is NOT a ` +
    `franchise: never bolt a zone onto it. Return null when the given name ` +
    `already follows this rule. ` +
    `"tags" are Mesita tags: up to ${MAX_PLACE_TAGS} slugs copied VERBATIM ` +
    `from the TAG VOCABULARY below that the sources clearly support (service, ` +
    `vibe, drinks, occasion, amenities…); [] when none is supported. ` +
    (familyLines.length ? `${FAMILIES_RULE} ` : "") +
    `${ZONE_RULE} ` +
    `"description" and ` +
    `every other text field MUST be a single JSON string — never an array or ` +
    `nested object. Use null or [] for anything the sources don't support. ` +
    `Never invent ratings, reviewer quotes, prices, or a chef's name.` +
    (vocabulary.length ? `\n\nTAG VOCABULARY: ${vocabulary.join(", ")}` : "") +
    (familyLines.length ? `\n\nFAMILY LIST:\n${familyLines.join("\n")}` : "") +
    (branchAnchor
      ? `\n\nLOCATION ANCHOR (the franchise rule spends this; the zone is read from it): ${branchAnchor}`
      : "") +
    (grounding
      ? `\n\n--- SOURCE MATERIAL ---\n${grounding}`
      : "\n\n(No extra source material was gathered.)")
  );
}
