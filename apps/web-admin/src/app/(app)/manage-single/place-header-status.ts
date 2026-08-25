import type { PlaceEnrichmentStatus } from "./actions";

/** True while the Intaker pipeline is mid-flight.
 *  decision: Pato (MESITA-453) — Enriching = the WHOLE pipeline:
 *  research OR analysis OR contents. Never clear after research alone. */
export function isEnriching(status: PlaceEnrichmentStatus | null): boolean {
  const stage = status?.stage ?? null;
  if (stage === "research" || stage === "analysis" || stage === "contents") {
    return true;
  }
  const contentStatus = status?.content_status ?? null;
  return contentStatus === "generating" || contentStatus === "queued";
}

export function isEnrichFailed(status: PlaceEnrichmentStatus | null): boolean {
  return status?.stage === "failed";
}

/**
 * Header category: keep the catalog emoji, never show a raw slug.
 * Catalog labels look like `"🪩 Nightclub"`; slugs like `nightclub` titleize.
 */
export function formatHeaderCategory(
  categoryLabel: string | null | undefined,
  category: string | null | undefined,
): { emoji: string; text: string } | null {
  const raw = (categoryLabel ?? "").trim() || (category ?? "").trim();
  if (!raw) return null;
  const textStart = raw.search(/[\p{L}\p{N}]/u);
  const emoji = textStart > 0 ? raw.slice(0, textStart).trim() : "";
  const rest = (textStart >= 0 ? raw.slice(textStart) : raw)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rest && !emoji) return null;
  const text = rest
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "bbq") return "BBQ";
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
  return { emoji, text: text || rest };
}
