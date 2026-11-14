// The Enricher's two quality tiers and the model each one runs, shared by the
// Models page and Creation's cost model. A neutral module: the kit must not
// import app routes, and a "use server" file may export only async functions.
//
// Two tiers since MESITA-2126: "high" ran the same gpt-4o as "standard" and was
// retired. ENRICHER_TIER_MODELS copies the backend's QUALITY_MODEL
// (supabase/functions/_shared/enrich-config.ts); a test on each side
// (_shared/enrich-tiers.test.ts, lib/synthesis-quality.test.ts) fails if the two
// drift, because each package's CI only runs when its own folder changes.
// "efficient" (MESITA-3945): gpt-6-luna, OpenAI's cheap replacement for
// gpt-4o-mini and gpt-4o (both shut down 2027-01-14), cheaper than either.
// One tier since MESITA-3966: economy (gpt-4o-mini) and standard (gpt-4o) are
// gone. A stored retired tier reads as efficient.
export const SYNTHESIS_QUALITIES = ["efficient"] as const;
export type SynthesisQuality = (typeof SYNTHESIS_QUALITIES)[number];

export const ENRICHER_TIER_MODELS: Record<SynthesisQuality, string> = {
  efficient: "gpt-6-luna",
};

/** A stored tier, read leniently: every value is the one tier, efficient. */
export function normalizeTier(_q: unknown): SynthesisQuality {
  return "efficient";
}
