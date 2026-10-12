// The Enricher's two quality tiers and the model each one runs, shared by the
// Models page and Creation's cost model. A neutral module: the kit must not
// import app routes, and a "use server" file may export only async functions.
//
// Two tiers since MESITA-2126: "high" ran the same gpt-4o as "standard" and was
// retired. ENRICHER_TIER_MODELS copies the backend's QUALITY_MODEL
// (supabase/functions/_shared/enrich-config.ts); a test on each side
// (_shared/enrich-tiers.test.ts, lib/synthesis-quality.test.ts) fails if the two
// drift, because each package's CI only runs when its own folder changes.
export const SYNTHESIS_QUALITIES = ["economy", "standard"] as const;
export type SynthesisQuality = (typeof SYNTHESIS_QUALITIES)[number];

export const ENRICHER_TIER_MODELS: Record<SynthesisQuality, string> = {
  economy: "gpt-4o-mini",
  standard: "gpt-4o",
};

/** A stored tier, read leniently: the retired "high" is "standard"; anything else unknown is "economy". */
export function normalizeTier(q: unknown): SynthesisQuality {
  if (q === "high" || q === "standard") return "standard";
  return "economy";
}
