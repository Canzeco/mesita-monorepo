import { openScore } from "../_shared/local-time.ts";
import type { Prediction } from "./memo-google-text-search.ts";

export function candidateBlock(
  candidates: Prediction[],
  maxCards: number,
): string {
  if (candidates.length === 0) return "";
  const lines = candidates.slice(0, maxCards).map((c, i) => {
    const bits: string[] = [c.mainText];
    if (c.secondaryText) bits.push(c.secondaryText.split(",")[0].trim());
    if (typeof c.rating === "number") bits.push(`★${c.rating.toFixed(1)}`);
    if (c.status !== "not_in_mesita") bits.push("on Mesita");
    if (c.openNow === true) bits.push("open now");
    else if (c.openNow === false) bits.push("closed now");
    return `${i + 1}. ${bits.join(" · ")}`;
  });
  return (
    ` [cards shown to the user below your reply — recommend from THESE so your` +
    ` words match the cards; weave 1–3 in naturally, don't list them all` +
    ` mechanically, and prefer open ones. If none truly fit the ask, say so` +
    ` briefly and give general guidance:\n${lines.join("\n")}]`
  );
}

export function mergeAndRankMemoPredictions(
  mesitaPreds: Prediction[],
  googlePreds: Prediction[],
): Prediction[] {
  const merged = new Map<string, Prediction>();
  for (const p of mesitaPreds) merged.set(p.placeId, p);
  for (const p of googlePreds) {
    if (!merged.has(p.placeId)) merged.set(p.placeId, p);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const aIn = a.status !== "not_in_mesita" ? 1 : 0;
    const bIn = b.status !== "not_in_mesita" ? 1 : 0;
    if (aIn !== bIn) return bIn - aIn;
    const openDelta = openScore(b.openNow) - openScore(a.openNow);
    if (openDelta !== 0) return openDelta;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
}
