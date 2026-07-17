// Memo only attaches place cards when the ask is actually place-seeking; pure
// knowledge/chat turns ("what does al pastor mean", "how do tips work") get a
// text-only reply. Heuristic, bilingual (ES/EN): explicit place words always
// search; an otherwise bare question reads as definitional -> text only.
export const PLACE_INTENT =
  /\b(near|nearby|around|close|best|top|recommend|recommendation|where|spot|spots|place|places|bar|bars|club|clubs|nightlife|restaurant|restaurants|cafe|coffee|taco|tacos|dinner|lunch|brunch|breakfast|drink|drinks|rooftop|date night|eat|food|hungry|open now|tonight|cerca|cercano|mejor|mejores|dónde|donde|lugar|lugares|antro|antros|comer|cena|cenar|comida|desayun|almuerz|bares|restaurante|café|reserva|abierto|esta noche|recomienda|recomiénda)\b/i;

export const DEFINITIONAL =
  /^\s*(what|why|how|who|when|which|is|are|does|do|can|should|explain|tell me|qué|que|por qué|porque|cómo|como|quién|quien|cuándo|cuando|cuál|cual|explica|dime)\b/i;

export function isPlaceSeeking(query: string): boolean {
  if (PLACE_INTENT.test(query)) return true; // explicit place words win
  if (DEFINITIONAL.test(query)) return false; // a bare question -> text only
  return true; // short noun-ish fragments ("sushi san pedro") read as searches
}
