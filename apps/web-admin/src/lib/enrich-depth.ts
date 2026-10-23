// Single operator Enrich mode (MESITA-2739): full pipeline only. Stored depth
// key stays `full` for admin-web-enrich-place compatibility.

export type EnrichDepth = "full";

export function enrichDepth(_value: unknown): EnrichDepth {
  return "full";
}

export const ENRICH_ACTIONS = [
  {
    depth: "full" as const,
    label: "Enrich",
    title: "Full enrichment pipeline (links, reviews, photos, presentation).",
  },
] as const satisfies readonly { depth: EnrichDepth; label: string; title: string }[];

export function enrichLabel(_depth: EnrichDepth = "full"): string {
  return "Enrich";
}
