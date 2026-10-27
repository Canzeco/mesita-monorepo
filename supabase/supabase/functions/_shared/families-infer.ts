// Families inference (MESITA-2827): 1–5 of Mesita's families for a place, by
// its own OpenAI call after the Google categories (Pato, 2026-10-26: "families
// también las va a inferir un large language model … como un trigger
// secundario"). Families are a list of their own: the categories are only a
// hint here, and editing them never rewrites the stored families. Callers pass
// the live list in, read by categories.ts (fetchPlaceFamilies).

import type { PlaceFamily } from "./categories.ts";
import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";
import { OPENAI_URL } from "./enrich-config.ts";

const DEFAULT_CLASSIFIER_MODEL = DEFAULT_MODELS_CONFIG.enricher.model!;

/** Families per place: 1 to 5 (MESITA-2827). */
export const FAMILIES_MAX = 5;

type FamilySignals = {
  name: string;
  address?: string | null;
  /** The place's Google categories as just inferred, shown one first. */
  googleCategories?: string[];
  /** The families those categories map to, as a hint. */
  mappedFamilies?: string[];
  googleTags?: string[];
  editorialSummary?: string | null;
  description?: string | null;
};

// Exported so admin Crenup can render them, like CATEGORY_INSTRUCTIONS.
export const FAMILY_INSTRUCTIONS =
  "You place a venue in ONE TO FIVE families from a fixed list. A family is " +
  "what a guest is in the mood for (dinner, coffee, drinks…). Respond with a " +
  'single JSON object {"families":["<slug>", ...]} where each <slug> is copied ' +
  "verbatim from the list. Pick every family a guest would expect to find the " +
  "place under and no more; most places fit one to three. The families mapped " +
  "from its categories are a hint, not the answer. Always return at least one " +
  "slug from the list.";

export function buildFamilyInput(catalog: string, placeLines: string): string {
  return `Families (slug — label):\n${catalog}\n\n` +
    `Place:\n${placeLines}\n\n` +
    `Return {"families":["<slug>", ...]} with one to five slugs.`;
}

/** The families the model sees: every live family except `undefined`. */
export function familyCatalog(families: PlaceFamily[]): PlaceFamily[] {
  return families.filter((f) => f.slug !== "undefined");
}

/**
 * The model's reply → 1–5 known family slugs. Unknown slugs and `undefined`
 * are dropped, labels are salvaged to slugs, duplicates keep their first
 * place. Null when the reply is not JSON or no slug survives, so the stored
 * families stay.
 */
export function parseFamiliesReply(
  content: string,
  families: PlaceFamily[],
): string[] | null {
  const offered = familyCatalog(families);
  const valid = new Set(offered.map((f) => f.slug));
  const labelToSlug = new Map(offered.map((f) => [normalise(f.label), f.slug] as const));
  let parsed: { families?: unknown };
  try {
    parsed = JSON.parse(content) as { families?: unknown };
  } catch {
    return null;
  }
  const raw = Array.isArray(parsed.families) ? parsed.families : [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const token = item.trim();
    if (!token) continue;
    const slug = valid.has(token) ? token : labelToSlug.get(normalise(token));
    if (slug && !out.includes(slug)) out.push(slug);
    if (out.length === FAMILIES_MAX) break;
  }
  return out.length > 0 ? out : null;
}

export async function inferPlaceFamilies(
  openaiKey: string | undefined,
  families: PlaceFamily[],
  signals: FamilySignals,
  model = DEFAULT_CLASSIFIER_MODEL,
): Promise<string[] | null> {
  const offered = familyCatalog(families);
  if (!openaiKey || offered.length === 0) return null;

  const catalog = offered.map((f) => `${f.slug} — ${f.label}`).join("\n");
  const cats = signals.googleCategories ?? [];
  const mapped = (signals.mappedFamilies ?? []).filter((k) => k !== "undefined");
  const placeLines = [
    `Name: ${signals.name}`,
    signals.address ? `Address: ${signals.address}` : "",
    cats.length ? `Google categories: ${cats.join(", ")}` : "",
    mapped.length ? `Families mapped from those categories: ${mapped.join(", ")}` : "",
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
          { role: "system", content: FAMILY_INSTRUCTIONS },
          { role: "user", content: buildFamilyInput(catalog, placeLines) },
        ],
      }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return parseFamiliesReply(data.choices?.[0]?.message?.content ?? "", families);
  } catch {
    return null;
  }
}

function normalise(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
