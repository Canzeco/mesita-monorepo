// Mesita Families, inferred (MESITA-2891). Pato, 2026-10-27: "Now the list of
// Mesita Families is infered when the description step is ran. Its infered
// with an LLM, not a dictionary. The max number of families per place is 5,
// the min number is 1."
//
// The Description step's one model call (Create's door and every Enrich)
// returns `families` beside the Presentation and the tags; this module is the
// vocabulary it is shown and the validator its reply passes through. A place
// whose main Google category is not enabled on Mesita (catalog_membership
// .enabled, Atlas) gets no families: it reads as Undefined, so Discovery keeps
// it off guest surfaces.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { PlaceFamily } from "./categories.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";

export const FAMILIES_MIN = 1;
/** One number with the editor's cap and the trigger's literal (MESITA-2893). */
export const FAMILIES_MAX = ENRICH_FIELD_LIMITS.familiesPerPlace.max;

/** The families the model may pick: every live family except Undefined. */
export function familyChoices(families: readonly PlaceFamily[]): PlaceFamily[] {
  return families.filter((f) => f.slug !== "undefined");
}

/** The FAMILY LIST block a prompt carries: `slug — Label`, one per line. */
export function familyVocabularyLines(families: readonly PlaceFamily[]): string[] {
  return familyChoices(families).map((f) => `${f.slug} — ${f.label}`);
}

/** The instruction both Description prompts carry for `families`. */
export const FAMILIES_RULE =
  `"families" are Mesita families: ${FAMILIES_MIN} to ${FAMILIES_MAX} slugs ` +
  "copied VERBATIM from the FAMILY LIST — what a guest is in the mood for " +
  "when they would look for this place (coffee, dinner, drinks, fun…). Pick " +
  "every family a guest would expect to find it under and no more; most " +
  "places fit one to three. Always return at least one.";

function normalise(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, " ").trim();
}

/**
 * The model's `families` → 1–5 known slugs, first-seen order. A label is
 * salvaged to its slug; Undefined, unknown and duplicate entries drop. Null
 * when nothing survives, so the caller keeps the stored list.
 */
export function pickFamilies(
  raw: unknown,
  families: readonly PlaceFamily[],
): string[] | null {
  if (!Array.isArray(raw)) return null;
  const offered = familyChoices(families);
  const valid = new Set(offered.map((f) => f.slug));
  const byLabel = new Map(offered.map((f) => [normalise(f.label), f.slug] as const));
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const token = item.trim();
    const slug = valid.has(token) ? token : byLabel.get(normalise(token));
    if (slug && !out.includes(slug)) out.push(slug);
    if (out.length === FAMILIES_MAX) break;
  }
  return out.length >= FAMILIES_MIN ? out : null;
}

/** The main Google category: the first of the place's Google categories. */
export function mainGoogleCategory(
  googleTypes: unknown,
  category: unknown,
): string | null {
  if (Array.isArray(googleTypes)) {
    const first = googleTypes.find((t): t is string => typeof t === "string" && t.trim() !== "");
    if (first) return first.trim();
  }
  return typeof category === "string" && category.trim() && category !== "undefined"
    ? category.trim()
    : null;
}

/** Is this Google category enabled on Mesita? A failed read answers no. */
export async function isGoogleCategoryEnabled(
  admin: SupabaseClient,
  slug: string | null,
): Promise<boolean> {
  if (!slug) return false;
  const { data, error } = await admin
    .from("catalog_membership")
    .select("enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return false;
  return (data as { enabled?: unknown }).enabled === true;
}

/**
 * What the Description step stores: the model's families when the main
 * Google category is enabled, none (null ⇒ Undefined) when it is not, and
 * `undefined` — keep the stored list — when the model gave nothing usable.
 */
export function familiesToStore(
  picked: string[] | null,
  enabled: boolean,
): string[] | null | undefined {
  if (!enabled) return null;
  return picked ?? undefined;
}
