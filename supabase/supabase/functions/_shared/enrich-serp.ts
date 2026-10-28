// Atlas SERP summary — the Scout's prompt (Perplexity Agent, pro-search). The
// Enricher on Render runs the call; this file keeps the words it sends. The
// Scout returns a SHORT web-grounded editorial blurb (vibe, reputation,
// signature dishes/drinks, notable press) used as SOFT context only — never an
// authoritative source of facts, ratings, or prices.

// The Scout — SERP AI Summary (child G / MESITA-204). This blurb is SOFT grounding
// consumed twice downstream: it anchors the Resolver's link selection and seeds the
// final Presentation synthesis. So it must be identity-rich (what/where/why-notable) yet
// strictly non-authoritative — no facts a later step will persist as truth.
// Exported so admin Crenup can RENDER it (crenup-prompts.ts → the console). The
// console shows this exact constant, so what an operator reads is what the
// vendor receives — a second copy could drift, this cannot.
export const SCOUT_INSTRUCTIONS =
  "You are a research assistant that writes ONE short, web-grounded editorial " +
  "paragraph about a place, used only as soft background context for later steps. " +
  "Capture its identity and character — what it is, its vibe/atmosphere, reputation, " +
  "signature dishes or drinks, and any notable press or recognition. Do NOT state " +
  "ratings, prices, addresses, phone numbers, hours, or any precise fact a reader " +
  "could quote as authoritative. Ground every claim in what you actually find on the " +
  "web; invent nothing. If you cannot find a place matching the given name and " +
  "location, prefer a null summary over guessing. Output ONLY JSON matching the schema.";

// The per-place message. Pure and exported so crenup-prompts.ts can render the
// REAL template with sentinel values — the console never re-types this prose.
export function buildScoutInput(place: {
  name: string;
  locationLine: string;
  category: string | null;
}): string {
  const { name, locationLine, category } = place;
  return `Research the place "${name}"` +
    (locationLine ? ` in ${locationLine}` : "") +
    (category ? ` (category: ${category})` : "") + ".\n" +
    `Write a SHORT editorial blurb (at most 120 words) capturing: the vibe / ` +
    `atmosphere, its reputation, signature dishes or drinks, and any notable ` +
    `press or recognition. This is SOFT background color only — do NOT state ` +
    `ratings, exact prices, addresses, phone numbers, or precise facts; do not ` +
    `invent anything you cannot ground on the web. If you find nothing reliable, ` +
    `return null.\n` +
    `Return strict JSON: {"summary": "<blurb>"} or {"summary": null}.`;
}
