// The Enricher's text-quality tiers, shared by the config kit's QualityPicker and the enricher/models pages.
// A neutral module: the kit must not import app routes, and a "use server" file may export only async functions.
export const SYNTHESIS_QUALITIES = ["economy", "standard", "high"] as const;
export type SynthesisQuality = (typeof SYNTHESIS_QUALITIES)[number];
