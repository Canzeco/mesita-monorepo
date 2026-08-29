// Super Category inference: OpenAI classifier over the Atlas list (the
// seven real supers in place_super_categories; never `undefined`). Used
// when the place has no classified Atlas category yet. Once Category is
// known, family_keys is that category's FULL membership (1–2 supers).
// The classifier may return one or two supers; a WRONG super is worse
// than none, so it stays conservative — empty means the caller falls
// back to ['undefined'] (resolveEnrichedFamilyKeys is total).

import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";
import {
  sanitizeFamilyKeys,
  type FamilyKey,
} from "./place-taxonomy.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_CLASSIFIER_MODEL = DEFAULT_MODELS_CONFIG.enricher.model!;

export type SuperCategoryOption = {
  slug: string;
  label: string;
};

type SuperSignals = {
  name: string;
  address?: string | null;
  category?: string | null;
  editorialSummary?: string | null;
  description?: string | null;
};

export async function inferPlaceSuperCategories(
  openaiKey: string | undefined,
  supers: SuperCategoryOption[],
  signals: SuperSignals,
  model = DEFAULT_CLASSIFIER_MODEL,
): Promise<FamilyKey[]> {
  if (!openaiKey || supers.length === 0) return [];
  const valid = new Set(supers.map((s) => s.slug));
  const catalog = supers.map((s) => `${s.slug} — ${s.label}`).join("\n");
  const placeLines = [
    `Name: ${signals.name}`,
    signals.address ? `Address: ${signals.address}` : "",
    signals.category ? `Atlas category: ${signals.category}` : "",
    signals.editorialSummary ? `Summary: ${signals.editorialSummary}` : "",
    signals.description ? `Details: ${signals.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemContent =
    "You classify a place into ONE or TWO Super Categories from a fixed list. " +
    'Respond with a single JSON object {"super_categories":["<slug>"]} ' +
    "where every slug is copied verbatim from the list. Most places get " +
    "exactly one; return two ONLY when the place genuinely lives in both " +
    "(a breakfast café is restaurants and cafes_bakeries; a karaoke bar is " +
    "bars_nightlife and experiences). Only classify when confident — a " +
    "wrong Super is worse than none. Never invent slugs. Never return " +
    "more than two.";
  const userPrompt =
    `Super Categories (slug — label):\n${catalog}\n\n` +
    `Place:\n${placeLines}\n\n` +
    `Return {"super_categories":["<one or two slugs from the list>"]}.`;

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
    let parsed: { super_categories?: unknown; super_category?: unknown };
    try {
      parsed = JSON.parse(content) as {
        super_categories?: unknown;
        super_category?: unknown;
      };
    } catch {
      return [];
    }
    const raw = Array.isArray(parsed.super_categories)
      ? parsed.super_categories
      : typeof parsed.super_category === "string"
      ? [parsed.super_category]
      : [];
    return sanitizeFamilyKeys(raw).filter((slug) => valid.has(slug));
  } catch {
    return [];
  }
}
