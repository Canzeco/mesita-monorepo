// Atlas synthesis — the "Research Backbone". Reads ONLY the gathered source
// material (Instagram bio, Google reviews, SERP editorial blurb) — no web
// access, so it can't drift — and compiles the canonical place profile JSON.
// The website is no longer scraped, so there is no menu source: products.menu
// is not synthesised. Model comes from the admin 'synthesis quality' param.

import {
  ENRICH_DESCRIPTION_MAX,
  ENRICH_DESCRIPTION_TARGET_WORDS,
  OPENAI_URL,
  QUALITY_MODEL,
} from "./enrich-config.ts";
import { safeParseJson } from "./parse-utils.ts";
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
    zone: { type: ["string", "null"] },
    city: { type: ["string", "null"] },
    established_year: { type: ["integer", "null"] },
    executive_chef: { type: ["string", "null"] },
    editorial_summary: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    mesita_name: { type: ["string", "null"] },
    details: {
      type: "object",
      properties: {
        dining_style: { type: ["string", "null"] },
        dress_code: { type: ["string", "null"] },
        service_options: { type: "array", items: { type: "string" } },
        reservations: { type: ["string", "null"] },
        payment_methods: { type: "array", items: { type: "string" } },
        parking: { type: ["string", "null"] },
        amenities: { type: "array", items: { type: "string" } },
        accessibility: { type: "array", items: { type: "string" } },
        dietary_options: { type: "array", items: { type: "string" } },
        good_for: { type: "array", items: { type: "string" } },
        languages: { type: "array", items: { type: "string" } },
        kid_friendly: { type: ["boolean", "null"] },
        pet_friendly: { type: ["boolean", "null"] },
      },
    },
    popular_times: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string" },
          range: { type: "string" },
        },
      },
    },
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
  // The branch anchor for the FRANCHISE RULE below: zone is the colonia /
  // neighborhood, city the fallback. Both come from the Google spine the
  // research stage persisted — synthesis never has to guess where it is.
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
    googleReviewsText, serpSummary,
  } = input;

  // Where this branch actually is — the qualifier the franchise rule spends.
  const branchAnchor = [
    zone ? `Neighborhood / zone: ${zone}` : "",
    city ? `City: ${city}` : "",
  ].filter(Boolean).join(" · ");

  const grounding = [
    igBio ? `Instagram bio: ${igBio}` : "",
    googleReviewsText ? `Google reviews (sample):\n${googleReviewsText}` : "",
    serpSummary
      ? `Web editorial color (SOFT context — background only, NOT authoritative; do not treat as a source of facts, ratings, or prices):\n${serpSummary}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt =
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
    `a rich, inviting, factual narrative of roughly ` +
    `${ENRICH_DESCRIPTION_TARGET_WORDS} words (max ` +
    `${ENRICH_DESCRIPTION_MAX} characters). ` +
    `CRITICAL — paragraphs: "description" MUST be several short paragraphs ` +
    `separated by a blank line (the two-character sequence \\n\\n). Never ` +
    `return one unbroken wall of text. Aim for 3–6 paragraphs; each ` +
    `paragraph is 2–4 sentences on one idea (atmosphere, cuisine, signature ` +
    `dishes or experiences, history or neighborhood, why visit) — only when ` +
    `the sources support it. No filler or invented detail. ` +
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
    `already follows this rule. "description" and ` +
    `every other text field MUST be a single JSON string — never an array or ` +
    `nested object. Use null or [] for anything the sources don't support. ` +
    `Never invent ratings, reviewer quotes, prices, or a chef's name.` +
    (branchAnchor
      ? `\n\nLOCATION ANCHOR (the franchise rule spends this): ${branchAnchor}`
      : "") +
    (grounding
      ? `\n\n--- SOURCE MATERIAL ---\n${grounding}`
      : "\n\n(No extra source material was gathered.)");

  const systemContent =
    "You are Mesita's place-intelligence synthesis agent. Use ONLY the source " +
    "material the user provides — do not browse or use outside knowledge. " +
    "Mesita's core language is English: all prose fields are English. " +
    "Output a SINGLE valid JSON object (no prose, no markdown fences) matching " +
    "this shape, using null or [] when the sources don't support a field: " +
    JSON.stringify(PROFILE_SCHEMA.properties) +
    " Text fields (zone, city, executive_chef, editorial_summary, description) " +
    "are single JSON strings — never arrays or nested objects. " +
    "For description: separate paragraphs with blank lines " +
    "(\\n\\n); never one continuous block. Never invent ratings, reviewer " +
    "quotes, prices, or a chef's name.";

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (r.ok) {
      const data = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = safeParseJson(data.choices?.[0]?.message?.content ?? "") as
        | ProfileResult
        | null;
      return { parsed, diag: { provider: "openai", model, ok: !!parsed } };
    }
    return { parsed: null, diag: { provider: "openai", model, ok: false, status: r.status } };
  } catch {
    return { parsed: null, diag: { provider: "openai", model, ok: false } };
  }
}
