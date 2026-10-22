// THE PRESENTATION CAP (MESITA-2641, Pato: "don't cut the presentation like
// that"). The ceiling is ENRICH_FIELD_LIMITS.description (500 characters,
// MESITA-2248); every writer of places.description goes through here:
// the Enricher's synthesis, the write-place fallback and the create door.
// Render's Google fallback (render/src/google-spine.ts) carries the same
// function; it is its own package and cannot import this file.
//
// Until MESITA-2641 each writer did `.slice(0, 500)`, and 44 of 53 stored
// presentations ended mid-word ("…with family o").
//
// Under the ceiling: unchanged (trimmed). Over it: cut at the last sentence
// end (. ! ? …) inside the ceiling. When the last sentence end sits in the
// first 40% (one huge sentence), cut at the last word instead and close with
// "…", still inside the ceiling. Never a mid-word cut.

import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";

const SENTENCE_END = /[.!?…](?=[\s"”'’)\]]|$)/g;
const MIN_KEEP = 0.4;

export function capPresentation(
  text: string,
  max: number = ENRICH_FIELD_LIMITS.description.max,
): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  let end = -1;
  for (const m of head.matchAll(SENTENCE_END)) end = (m.index ?? -1) + 1;
  if (end >= max * MIN_KEEP) return head.slice(0, end).trimEnd();
  const room = t.slice(0, max - 1);
  const space = room.lastIndexOf(" ");
  const cut = space >= max * MIN_KEEP ? room.slice(0, space) : room;
  return `${cut.replace(/[\s,;:–—-]+$/, "")}…`;
}
