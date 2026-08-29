// LLM gate for the guest Reserve CTA (Description → Actions).
//
// Answers: does this KIND of place typically take reservations?
// Fast food, taquerías, street food → false. Sit-down restaurants, clubs
// with tables, tasting menus → true. Default false on any error.

import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = DEFAULT_MODELS_CONFIG.enricher.model!;

export type ReservationInferSignals = {
  name: string;
  category?: string | null;
  categoryLabel?: string | null;
  description?: string | null;
  priceLevel?: number | null;
  editorialSummary?: string | null;
};

export async function inferPlaceReservationsLikely(
  openaiKey: string | undefined,
  signals: ReservationInferSignals,
  model = DEFAULT_MODEL,
): Promise<boolean> {
  if (!openaiKey) return false;

  const lines = [
    `Name: ${signals.name}`,
    signals.categoryLabel
      ? `Category: ${signals.categoryLabel}`
      : signals.category
        ? `Category slug: ${signals.category}`
        : "",
    signals.priceLevel != null ? `Price level (1–4): ${signals.priceLevel}` : "",
    signals.editorialSummary ? `Summary: ${signals.editorialSummary}` : "",
    signals.description ? `About: ${signals.description.slice(0, 1200)}` : "",
  ].filter(Boolean).join("\n");

  const system =
    "You decide whether guests typically NEED or EXPECT reservations at this kind of venue. " +
    "Walk-in casual (fast food, taquería, street tacos, coffee to-go, food court) → false. " +
    "Sit-down dining, fine dining, tasting menu, nightclub with tables, omakase → true. " +
    'Respond with JSON only: {"reservations_likely":true} or {"reservations_likely":false}.';
  const user =
    `Place:\n${lines}\n\n` +
    "Would a typical guest reserve a table or time slot here? Return reservations_likely.";

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
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!r.ok) return false;
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed: { reservations_likely?: unknown };
    try {
      parsed = JSON.parse(content) as { reservations_likely?: unknown };
    } catch {
      return false;
    }
    return parsed.reservations_likely === true;
  } catch {
    return false;
  }
}
