// Super Category inference: OpenAI classifier over the Atlas list (5–10
// slugs; live catalog is the seven in place_super_categories). Used when
// the place has no classified Atlas category yet. Once Category is
// known, family_keys is that category's one Super — including Super
// `undefined` while category stays `undefined`. Empty here = leave
// family_keys unset only for leftover non-Atlas slugs.

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
    "You classify a place into exactly one Super Category from a fixed list. " +
    'Respond with a single JSON object {"super_categories":["<slug>"]} ' +
    "where the slug is copied verbatim from the list. A Super Category is a " +
    "partition of categories (nightlife includes bars and nightclubs; brunch " +
    "is restaurants, not cafés). Never invent slugs. Never return more than one.";
  const userPrompt =
    `Super Categories (slug — label):\n${catalog}\n\n` +
    `Place:\n${placeLines}\n\n` +
    `Return {"super_categories":["<one slug from the list>"]}.`;

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
