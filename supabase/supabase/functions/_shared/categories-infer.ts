// Place-category inference: OpenAI classifier + token normaliser.
// Extracted from categories.ts.

import type { PlaceCategory } from "./categories.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_CLASSIFIER_MODEL = "gpt-4o-mini";

// Signals fed to the classifier. All optional except name — the more present,
// the sharper the pick, but the place name alone already yields a sane guess.
type CategorySignals = {
  name: string;
  address?: string | null;
  googlePrimaryType?: string | null;
  googlePrimaryTypeDisplay?: string | null;
  googleTypes?: string[];
  editorialSummary?: string | null;
  description?: string | null;
};

// Picks the single best-matching category slug for a place from the live list.
// Returns null when there's no OpenAI key, no categories, or the model errors.
// The model is instructed to ALWAYS return the closest slug from the provided
// list (never free text, never null). We still validate against the live slug
// set and attempt a tolerant salvage by matching returned labels to slugs.
//
// The category list is passed in (the caller reads it once) so a single run
// never hits the table twice.
export async function inferPlaceCategory(
  openaiKey: string | undefined,
  categories: PlaceCategory[],
  signals: CategorySignals,
  model = DEFAULT_CLASSIFIER_MODEL,
): Promise<string | null> {
  if (!openaiKey || categories.length === 0) return null;
  const valid = new Set(categories.map((c) => c.slug));
  const labelToSlug = new Map(
    categories.map((c) => [normaliseCategoryToken(c.label), c.slug] as const),
  );

  const catalog = categories
    .map((c) => `${c.slug} — ${c.label} [${c.section}]`)
    .join("\n");
  const placeLines = [
    `Name: ${signals.name}`,
    signals.address ? `Address: ${signals.address}` : "",
    signals.googlePrimaryTypeDisplay
      ? `Google primary type: ${signals.googlePrimaryTypeDisplay}`
      : signals.googlePrimaryType
        ? `Google primary type: ${signals.googlePrimaryType}`
        : "",
    signals.googleTypes && signals.googleTypes.length
      ? `Google types: ${signals.googleTypes.join(", ")}`
      : "",
    signals.editorialSummary ? `Summary: ${signals.editorialSummary}` : "",
    signals.description ? `Details: ${signals.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemContent =
    "You classify a place into EXACTLY ONE category from a fixed list. " +
    'Respond with a single JSON object {"category":"<slug>"} where <slug> is ' +
    "copied verbatim from the list. Choose the MOST SIMILAR and most specific " +
    "category for the place's main offering. Always return one slug from the " +
    "list, even when uncertain.";
  const userPrompt =
    `Categories (slug — label [section]):\n${catalog}\n\n` +
    `Place:\n${placeLines}\n\n` +
    `Return {"category":"<one slug from the list>"}.`;

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
    if (!r.ok) return null;
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed: { category?: unknown };
    try {
      parsed = JSON.parse(content) as { category?: unknown };
    } catch {
      return null;
    }
    const raw = typeof parsed.category === "string" ? parsed.category.trim() : "";
    if (!raw) return null;
    if (valid.has(raw)) return raw;

    // Tolerant salvage: model occasionally emits the human label instead of the
    // slug. Normalise and map label -> slug.
    const byLabel = labelToSlug.get(normaliseCategoryToken(raw));
    if (byLabel && valid.has(byLabel)) return byLabel;
    return null;
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
