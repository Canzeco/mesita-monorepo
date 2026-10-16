// The two Enrich buttons. Quick is Google's own record. Full is the paid run.
// Fast and Deep stay Discovery's search modes, so Enrich does not reuse them.

export type EnrichDepth = "quick" | "full";

export function enrichDepth(value: unknown): EnrichDepth {
  return value === "quick" ? "quick" : "full";
}

export const ENRICH_ACTIONS = [
  {
    depth: "quick",
    label: "Quick",
    title: "Google's details, hours, photos, and summary.",
  },
  {
    depth: "full",
    label: "Full",
    title: "Links, Instagram, reviews, vision, and a description.",
  },
] as const satisfies readonly { depth: EnrichDepth; label: string; title: string }[];
