// The two Enrich buttons. Weak Enrich is Google's own record; Strong Enrich is
// the paid run. decision: Pato (2026-10-18, MESITA-2335) — "Weak Enrich" and
// "Strong Enrich", replacing MESITA-2320's Fast/Deep (which collided with
// Discovery's Deep). The stored depth keys stay `quick` / `full`.

export type EnrichDepth = "quick" | "full";

export function enrichDepth(value: unknown): EnrichDepth {
  return value === "quick" ? "quick" : "full";
}

export const ENRICH_ACTIONS = [
  {
    depth: "quick",
    label: "Weak Enrich",
    title: "Google's details, hours, photos, and summary.",
  },
  {
    depth: "full",
    label: "Strong Enrich",
    title: "Links, Instagram, reviews, vision, and a description.",
  },
] as const satisfies readonly { depth: EnrichDepth; label: string; title: string }[];

/** The button label for a depth, for confirms and notes. */
export function enrichLabel(depth: EnrichDepth): string {
  return ENRICH_ACTIONS.find((a) => a.depth === depth)?.label ?? "Strong Enrich";
}
