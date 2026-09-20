// Family inference: OpenAI classifier over the Atlas list (the seven real
// families in place_families; never `undefined`). Used when the place has
// no classified Atlas category yet. Once Category is known, family_keys is
// that category's FULL membership (1–2 families). The classifier may return
// one or two; a WRONG family is worse than none, so it stays conservative —
// empty means the caller falls back to ['undefined']
// (resolveEnrichedFamilyKeys is total).

import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";
import {
  sanitizeFamilyKeys,
  type FamilyKey,
} from "./place-taxonomy.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_CLASSIFIER_MODEL = DEFAULT_MODELS_CONFIG.enricher.model!;

export type FamilyOption = {
  slug: string;
  label: string;
};

type FamilySignals = {
  name: string;
  address?: string | null;
  category?: string | null;
  editorialSummary?: string | null;
  description?: string | null;
};

// Exported so admin Crenup can RENDER them (crenup-prompts.ts → the console).
// The console shows these exact values, so what an operator reads is what the
// vendor receives — a second copy could drift, this cannot.
export const FAMILY_INSTRUCTIONS =
  "You classify a place into ONE or TWO families from a fixed list. " +
  'Respond with a single JSON object {"families":["<slug>"]} ' +
  "where every slug is copied verbatim from the list. Most places get " +
  "exactly one; return two ONLY when the place genuinely lives in both " +
  "(a breakfast café is restaurants and cafes_bakeries; a karaoke bar is " +
  "bars_nightlife and experiences). Only classify when confident — a " +
  "wrong family is worse than none. Never invent slugs. Never return " +
  "more than two.";

export function buildFamilyInput(catalog: string, placeLines: string): string {
  return `Families (slug — label):\n${catalog}\n\n` +
    `Place:\n${placeLines}\n\n` +
    `Return {"families":["<one or two slugs from the list>"]}.`;
}

export async function inferPlaceFamilies(
  openaiKey: string | undefined,
  families: FamilyOption[],
  signals: FamilySignals,
  model = DEFAULT_CLASSIFIER_MODEL,
): Promise<FamilyKey[]> {
  if (!openaiKey || families.length === 0) return [];
  const valid = new Set(families.map((f) => f.slug));
  const catalog = families.map((f) => `${f.slug} — ${f.label}`).join("\n");
  const placeLines = [
    `Name: ${signals.name}`,
    signals.address ? `Address: ${signals.address}` : "",
    signals.category ? `Atlas category: ${signals.category}` : "",
    signals.editorialSummary ? `Summary: ${signals.editorialSummary}` : "",
    signals.description ? `Details: ${signals.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemContent = FAMILY_INSTRUCTIONS;
  const userPrompt = buildFamilyInput(catalog, placeLines);

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
          { role: "system", content: systemContent },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed: { families?: unknown; family?: unknown };
    try {
      parsed = JSON.parse(content) as {
        families?: unknown;
        family?: unknown;
      };
    } catch {
      return [];
    }
    const raw = Array.isArray(parsed.families)
      ? parsed.families
      : typeof parsed.family === "string"
      ? [parsed.family]
      : [];
    return sanitizeFamilyKeys(raw).filter((slug) => valid.has(slug));
  } catch {
    return [];
  }
}
