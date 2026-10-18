// The two Enrich buttons. Fast Enrich is Google's own record; Deep Enrich is
// the paid run. decision: Pato (2026-10-17, MESITA-2320) — "Fast Enrich" and
// "Deep Enrich" (the "Enrich" suffix keeps them apart from Discovery's Fast/Deep
// search modes). The stored depth keys stay `quick` / `full`.

export type EnrichDepth = "quick" | "full";

export function enrichDepth(value: unknown): EnrichDepth {
  return value === "quick" ? "quick" : "full";
}

export const ENRICH_ACTIONS = [
  {
    depth: "quick",
    label: "Fast Enrich",
    title: "Google's details, hours, photos, and summary.",
  },
  {
    depth: "full",
    label: "Deep Enrich",
    title: "Links, Instagram, reviews, vision, and a description.",
  },
] as const satisfies readonly { depth: EnrichDepth; label: string; title: string }[];

/** The button label for a depth, for confirms and notes. */
export function enrichLabel(depth: EnrichDepth): string {
  return ENRICH_ACTIONS.find((a) => a.depth === depth)?.label ?? "Deep Enrich";
}
