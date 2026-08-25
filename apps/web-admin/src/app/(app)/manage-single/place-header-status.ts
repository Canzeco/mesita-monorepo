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

export type HeaderFact = {
  key: string;
  label: string;
  on: boolean | "unknown";
};

export function generalHeaderFacts(input: {
  seeded?: boolean;
  listed?: boolean;
  business_status?: string | null;
  enrich_pulse?: number;
  enrich_pulse_total?: number;
  partner: boolean;
  promoting: boolean;
  verified: boolean | "unknown";
}): HeaderFact[] {
  const created: boolean | "unknown" =
    typeof input.seeded === "boolean" ? input.seeded : "unknown";
  const listed: boolean | "unknown" =
    typeof input.listed === "boolean" ? input.listed : "unknown";
  const active: boolean | "unknown" =
    input.business_status == null || input.business_status === ""
      ? "unknown"
      : input.business_status === "OPERATIONAL";
  const pulse = typeof input.enrich_pulse === "number" ? input.enrich_pulse : null;
  const total = typeof input.enrich_pulse_total === "number" ? input.enrich_pulse_total : null;
  const enriched: boolean | "unknown" =
    pulse === null || total === null || total === 0 ? "unknown" : pulse >= total;
  return [
    { key: "seeded", label: "Created", on: created },
    { key: "active", label: "Active", on: active },
    { key: "listed", label: "Listed", on: listed },
    { key: "enriched", label: "Enriched", on: enriched },
    { key: "verified", label: "Verified", on: input.verified },
    { key: "partner", label: "Partner", on: input.partner },
    { key: "promoting", label: "Promoting", on: input.promoting },
  ];
}

