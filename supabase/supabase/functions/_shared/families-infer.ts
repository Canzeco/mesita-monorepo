// Mesita Families, inferred (MESITA-2891). Pato, 2026-10-27: "Now the list of
// Mesita Families is infered when the description step is ran. Its infered
// with an LLM, not a dictionary. The max number of families per place is 5,
// the min number is 1." Raised to 7 on 2026-10-29 (MESITA-3087).
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
import { isRestaurantType, placeFamilies } from "./sourcing.ts";

export const FAMILIES_MIN = 1;
/** One number with the editor's cap and the trigger's literal (MESITA-2893). */
export const FAMILIES_MAX = ENRICH_FIELD_LIMITS.familiesPerPlace.max;

/**
 * The families the model may pick: every live family except Undefined and
 * Restaurants, which code adds (offered, it made the model skip Dinner:
 * families-eval recall 0.46).
 */
export function familyChoices(families: readonly PlaceFamily[]): PlaceFamily[] {
  return families.filter((f) => f.slug !== "undefined" && f.slug !== "restaurants");
}

/**
 * What every family means (MESITA-4237 started it for eight; MESITA-4238 gives
 * all 37 a line and tightened Family and Fun; MESITA-4571 cut the list to
 * thirty and both went; twenty-five since MESITA-4818). On 2026-11-17 Family sat on 83%
 * of places and Dinner on 76%: shown only a label, the model read Family as
 * "kids allowed" and Dinner as "open at night". Each line says what belongs
 * and, where the model strayed, the near-miss that does not. Keyed by slug,
 * which never changes; a live family without a line renders as its label.
 * This map is the master; Docs › Atlas points here.
 */
export const FAMILY_MEANINGS: Readonly<Record<string, string>> = {
  coffee: "a café or coffee bar — coffee is a main reason to go, including cafés that also serve breakfast or brunch",
  breakfast: "breakfast or brunch is a main meal — a morning place; not a taquería, grill or restaurant that merely opens early",
  sweet: "dessert or baked goods are the point — ice cream, gelato, cakes, pastries, churros, chocolate, a bakery or pastry shop",
  healthy: "the menu is built around healthy food — salads, bowls, juices, vegan",
  quick_bite: "eat fast — counter service, street food, takeout",
  tacos: "a taquería, or tacos are the main dish; not every Mexican restaurant",
  burgers: "burgers are the main dish",
  pizza: "pizza is the main dish",
  sushi: "sushi or poke is the main dish",
  steak: "a steakhouse or grill — beef cuts and barbecue are the point",
  seafood: "the menu is seafood — mariscos, ceviche, fish, oysters",
  italian: "the menu is Italian — pasta, risotto, Italian dishes",
  japanese: "the menu is Japanese — sushi, ramen, izakaya dishes",
  asian: "an Asian cuisine other than Japanese — Chinese, Indian, Korean, Thai, Vietnamese, Indonesian, pan-Asian",
  arabic: "Middle Eastern or eastern Mediterranean — Lebanese, Turkish, Greek, kebab",
  european: "another European cuisine — Spanish, French, German, tapas",
  american: "American food — diner, barbecue joint, wings or fried chicken, fries and shakes",
  brunch: "weekend brunch is a main reason to go — chilaquiles, eggs, pancakes and mimosas at a sit-down table people book, or the place calls itself brunch; not every café or restaurant that serves breakfast",
  dinner: "a dinner destination — the evening meal is the occasion: bistros, steakhouses, trattorias, tasting menus, date-night places people book; not a casual or everyday restaurant that also serves at night, nor a café, counter, bar or beach club",
  fancy: "genuinely upscale — fine dining, a tasting menu, a dress code or special-occasion prices; not merely stylish, popular, well rated or at a nice hotel",
  drinks: "drinking is the point — a bar, cantina, brewery or wine bar; not a restaurant that serves beer",
  fun: "an activity a group does — bowling, arcades, karts, escape rooms, billiards, mini golf, rinks, water parks; not a lively restaurant or a beach club",
  casino: "a casino — slots and gaming tables are the draw",
  night_out: "a club — a nightclub (antro) with a dance floor or DJs, a late-night party, or a place known for live bands; not a quiet lounge, rooftop or cocktail bar, nor a restaurant that is merely open late",
};

/** The FAMILY LIST block a prompt carries: `slug — Label`, plus its meaning. */
export function familyVocabularyLines(families: readonly PlaceFamily[]): string[] {
  return familyChoices(families).map((f) => {
    const meaning = FAMILY_MEANINGS[f.slug];
    return meaning ? `${f.slug} — ${f.label}: ${meaning}` : `${f.slug} — ${f.label}`;
  });
}

/**
 * Which Description call is picking (MESITA-4238). Create's door sees thin
 * Google signals; Enrich (and the re-pick) sees the gathered sources. More
 * evidence can support more families — but the count is a suggestion in the
 * prompt only (Pato, 2026-11-17: "not a strict limit … ONLY IN THE PROMPT");
 * `FAMILIES_MAX` (7) stays the one hard ceiling, in `pickFamilies`.
 */
export type FamiliesStage = "create" | "enrich";

/**
 * The instruction a Description prompt carries for `families`. `max` is the
 * stage's Atlas limit (MESITA-4581): the prompt never asks for more, and
 * `pickFamilies` keeps no more.
 */
export function familiesRule(stage: FamiliesStage, max: number = FAMILIES_MAX): string {
  const cap = Math.max(1, Math.min(max, FAMILIES_MAX));
  const usual = Math.min(stage === "create" ? 3 : 4, cap);
  const count = stage === "create"
    ? `With only these thin signals, usually pick one to ${usual}, and never more than ${cap}.`
    : `Usually pick one to ${usual}; never more than ${cap}, and go past ${usual} only when the sources clearly support each one.`;
  return (
    `"families" are Mesita families: slugs copied VERBATIM from the FAMILY ` +
    "LIST — what a guest is in the mood for when they would look for this " +
    "place. Pick a family only when this place matches the meaning its FAMILY " +
    "LIST line gives and a guest browsing that family would be glad to find " +
    "it there. An amenity never earns a family: welcoming kids, serving " +
    "alcohol, having music or being open late is not Bar or Club. " +
    "Cuisine and meal families (every cuisine, Breakfast, Brunch, Coffee, " +
    "Quick) describe what the place serves: give each one that truly applies; " +
    "Dinner only when its meaning fits. When unsure about a family, leave " +
    "it out — but always return at least one, the closest by meaning; only for a " +
    `plain restaurant that truly matches none, return an empty list. ${count}`
  );
}

/**
 * The families a Google hint may name (MESITA-4238): cuisines and the
 * morning trio. Never a venue family (drinks, fun, casino, night…) nor a
 * generic one (dinner, fancy, healthy, quick_bite, sweet): the code map gives
 * Bar to `bar_and_grill` and Dinner to every sit-down cuisine, which would nudge the exact false positives this fixes.
 */
export const HINT_FAMILIES: ReadonlySet<string> = new Set([
  "tacos", "sushi", "japanese", "italian", "pizza", "burgers",
  "seafood", "steak", "asian", "arabic", "european",
  "american", "coffee", "breakfast", "brunch",
]);

/**
 * The line a Description prompt adds after the FAMILY LIST: what Google's own
 * categories suggest, filtered to `HINT_FAMILIES` after `placeFamilies`.
 * Evidence, never a whitelist. "" when Google suggests nothing hintable.
 */
export function familyHintLine(googleTypes: unknown, category: unknown): string {
  const types = Array.isArray(googleTypes)
    ? googleTypes.filter((t): t is string => typeof t === "string" && t.trim() !== "")
    : [];
  const hinted = placeFamilies(mainGoogleCategory(types, category), types)
    .filter((f) => HINT_FAMILIES.has(f));
  return hinted.length
    ? `Google's categories suggest these cuisine families (evidence, not a whitelist): ${hinted.join(", ")}`
    : "";
}

function normalise(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, " ").trim();
}

/**
 * The model's `families` → 1–7 known slugs, first-seen order. A label is
 * salvaged to its slug; Undefined, unknown and duplicate entries drop. Null
 * when nothing survives, so the caller keeps the stored list.
 */
export function pickFamilies(
  raw: unknown,
  families: readonly PlaceFamily[],
  max: number = FAMILIES_MAX,
): string[] | null {
  const cap = Math.max(1, Math.min(max, FAMILIES_MAX));
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
    if (out.length === cap) break;
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

/**
 * Restaurants, settled by code (MESITA-4820): on every place whose main Google
 * category is a restaurant, beside the model's picks and past the stage's
 * limit (never past seven). `raw` is the model's own reply.
 */
export function settleRestaurants(
  picked: string[] | null,
  mainCategory: string | null,
  raw?: unknown,
): string[] | null {
  if (!isRestaurantType(mainCategory)) return picked;
  // An empty list is an answer for a restaurant: nothing sharper fits.
  if (!picked) return Array.isArray(raw) && raw.length === 0 ? ["restaurants"] : null;
  return ["restaurants", ...picked].slice(0, FAMILIES_MAX);
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
