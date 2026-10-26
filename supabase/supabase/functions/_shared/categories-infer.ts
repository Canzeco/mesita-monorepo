// Place-category inference: OpenAI classifier + token normaliser.
// Callers pass the live slug list in, usually read by categories.ts
// (fetchPlaceCategories).

import type { PlaceCategory } from "./categories.ts";
import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";
import { OPENAI_URL } from "./enrich-config.ts";

/** Fallback when caller omits models_config.enricher.model. */
const DEFAULT_CLASSIFIER_MODEL = DEFAULT_MODELS_CONFIG.enricher.model!;

// Signals fed to the classifier. All optional except name — the more present,
// the sharper the pick, but the place name alone already yields a sane guess.
type CategorySignals = {
  name: string;
  address?: string | null;
  /** google_types as stored: Google's primary first (MESITA-2790). */
  googleTypes?: string[];
  googleTags?: string[];
  editorialSummary?: string | null;
  description?: string | null;
};

/** Mesita categories per place: 1 to 3, main first (MESITA-2790). */
export const MESITA_CATEGORIES_MAX = 3;

// Picks the 1–3 best-matching Mesita category slugs for a place from the live
// list, main first. Returns null when there's no OpenAI key, no categories,
// the model errors, or no valid slug comes back. The model must copy slugs
// from the list; we still validate against the live slug set and salvage a
// returned label by matching it to its slug. `undefined` is never offered
// and never returned.
//
// The category list is passed in (the caller reads it once) so a single run
// never hits the table twice.
// Exported so admin Crenup can RENDER them (crenup-prompts.ts → the console).
// The console shows these exact values, so what an operator reads is what the
// vendor receives — a second copy could drift, this cannot.
export const CATEGORY_INSTRUCTIONS =
  "You classify a place into ONE TO THREE categories from a fixed list. " +
  'Respond with a single JSON object {"categories":["<slug>", ...]} where each ' +
  "<slug> is copied verbatim from the list. Put the place's main offering " +
  "first, then at most two more that a guest would also search it under. " +
  "Choose the most specific categories; prefer one when one fits. Always " +
  "return at least one slug from the list, even when uncertain.";

export function buildCategoryInput(catalog: string, placeLines: string): string {
  return `Categories (slug — label [section]):\n${catalog}\n\n` +
    `Place:\n${placeLines}\n\n` +
    `Return {"categories":["<main slug>", "<optional slug>", "<optional slug>"]}.`;
}

/** The catalog the model sees: every live category except `undefined`. */
export function categoryCatalog(categories: PlaceCategory[]): PlaceCategory[] {
  return categories.filter((c) => c.slug !== "undefined");
}

/**
 * The model's reply → 1–3 known slugs, main first. Unknown slugs and
 * `undefined` are dropped, labels are salvaged to slugs, duplicates keep
 * their first place. Null when the reply is not JSON or no slug survives.
 */
export function parseCategoriesReply(
  content: string,
  categories: PlaceCategory[],
): string[] | null {
  const offered = categoryCatalog(categories);
  const valid = new Set(offered.map((c) => c.slug));
  const labelToSlug = new Map(
    offered.map((c) => [normaliseCategoryToken(c.label), c.slug] as const),
  );
  let parsed: { categories?: unknown; category?: unknown };
  try {
    parsed = JSON.parse(content) as { categories?: unknown; category?: unknown };
  } catch {
    return null;
  }
  const raw = Array.isArray(parsed.categories)
    ? parsed.categories
    : typeof parsed.category === "string"
      ? [parsed.category]
      : [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const token = item.trim();
    if (!token) continue;
    const slug = valid.has(token) ? token : labelToSlug.get(normaliseCategoryToken(token));
    if (slug && valid.has(slug) && !out.includes(slug)) out.push(slug);
    if (out.length === MESITA_CATEGORIES_MAX) break;
  }
  return out.length > 0 ? out : null;
}

export async function inferPlaceCategories(
  openaiKey: string | undefined,
  categories: PlaceCategory[],
  signals: CategorySignals,
  model = DEFAULT_CLASSIFIER_MODEL,
): Promise<string[] | null> {
  const offered = categoryCatalog(categories);
  if (!openaiKey || offered.length === 0) return null;

  const catalog = offered
    .map((c) => `${c.slug} — ${c.label} [${c.section}]`)
    .join("\n");
  const types = signals.googleTypes ?? [];
  const placeLines = [
    `Name: ${signals.name}`,
    signals.address ? `Address: ${signals.address}` : "",
    types[0] ? `Google primary category: ${types[0]}` : "",
    types.length > 1 ? `Other Google categories: ${types.slice(1).join(", ")}` : "",
    signals.googleTags && signals.googleTags.length
      ? `Google attributes: ${signals.googleTags.join(", ")}`
      : "",
    signals.editorialSummary ? `Summary: ${signals.editorialSummary}` : "",
    signals.description ? `Details: ${signals.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CATEGORY_INSTRUCTIONS },
          { role: "user", content: buildCategoryInput(catalog, placeLines) },
        ],
      }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return parseCategoriesReply(data.choices?.[0]?.message?.content ?? "", categories);
  } catch {
    return null;
  }
}

function normaliseCategoryToken(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
