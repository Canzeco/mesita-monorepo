import { TONES, type Tone } from "./notification-config";

// The Enricher runs as three cron EFs (supabase-cron-enrich-place-*); each
// step event carries its S-code, which maps a step onto one of the phases.
// Colors follow the catalog: Research≈Link=emerald, Analysis=sky,
// Contents/Persist=amber.
export type EnricherPhase = {
  label: string;
  blurb: string;
  tone: Tone;
};

const ENRICHER_PHASES: Record<
  "research" | "analysis" | "contents",
  EnricherPhase
> = {
  research: {
    label: "Research",
    blurb:
      "Gathers the raw material (S0–S4): Google profile, reviews & SERP, channel links, source harvest.",
    tone: TONES.emerald,
  },
  analysis: {
    label: "Analysis",
    blurb:
      "Vision pass over candidate photos (S5–S6): describes each one, then ranks and selects the gallery.",
    tone: TONES.sky,
  },
  contents: {
    label: "Contents",
    blurb:
      "Writes the profile (S7–S9): synthesizes About, category & tags, then persists data and images.",
    tone: TONES.amber,
  },
};

export function enricherPhase(meta: Record<string, unknown>): EnricherPhase | null {
  const step = typeof meta.step === "string" ? meta.step : null;
  const m = step ? /^S(\d+)/i.exec(step.trim()) : null;
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 4) return ENRICHER_PHASES.research;
  if (n <= 6) return ENRICHER_PHASES.analysis;
  if (n <= 9) return ENRICHER_PHASES.contents;
  return null;
}
