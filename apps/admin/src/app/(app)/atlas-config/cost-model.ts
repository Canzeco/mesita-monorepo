import type { SynthesisQuality } from "./actions";

// Cost estimate — the pure model behind the calculator + the inline cost card.
//
// Per-call USD rate card. MIRRORS the cost constants in the enricher
// (atlas-get-enriched-place `COST`), plus the Google Places Details call the
// enrichment makes at create time. Approximate — enough to compare
// configurations, not for billing. Keep in sync with the enricher.
const COST_RATES = {
  googlePlaces: 0.017, // Places Details lookup at create (Pro SKU, ~$17/1k)
  apifyGoogleMaps: 0.05, // compass run: all reviews + place photos
  firecrawlSearch: 0.002, // one channel-discovery web search
  perplexity: 0.01, // discovery fallback (sonar)
  apifyInstagram: 0.02, // IG profile scraper
  apifyFacebook: 0.02, // FB pages scraper
  firecrawlScrape: 0.01, // S3 channel-discovery footer scrape
  visionEconomy: 0.002, // gpt-4o-mini vision, one image (detail:low)
  visionStandard: 0.01, // gpt-4o vision, one image
  sort: 0.003, // gpt-4o-mini text sort
  synthEconomy: 0.005, // gpt-4o-mini synthesis
  synthStandard: 0.03, // gpt-4o synthesis (standard & high)
} as const;

// Rough wall-clock seconds per step. The gather steps overlap (the enricher
// fires them with Promise.all), so the per-place total uses the stage model
// (pre + max(gather) + post), NOT the column sum.
const TIME_RATES = {
  googlePlaces: 2, // Places Details lookup
  apifyGoogleMaps: 45, // Apify reviews + photos — the slow one
  discoverySearch: 6, // 3 × Firecrawl search
  discoveryFallback: 4, // Perplexity
  apifyInstagram: 25, // Apify IG run
  apifyFacebook: 15, // Apify FB run
  visionEconomy: 1.0, // gpt-4o-mini vision / image
  visionStandard: 1.8, // gpt-4o vision / image
  sort: 3, // text sort
  synthEconomy: 6, // gpt-4o-mini synthesis
  synthStandard: 12, // gpt-4o synthesis
} as const;

export const money = (n: number) => `$${n.toFixed(3)}`;

// Compact duration: 45s · 1m 20s · 2h 5m.
export const fmtTime = (secs: number) => {
  const s = Math.round(secs);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const STAGE_META = {
  pre: { label: "Setup", hint: "Runs before sources are fetched" },
  gather: { label: "Gather", hint: "Sources fetched in parallel — time is the slowest step" },
  post: { label: "Analyze & write", hint: "Vision, sorting, and profile synthesis" },
} as const;

export type Stage = keyof typeof STAGE_META;

export type CostLine = {
  label: string;
  detail: string;
  cost: number;
  secs: number;
  stage: Stage;
  active: boolean;
};

export type CostParams = {
  quality: SynthesisQuality;
  imageModel: SynthesisQuality;
  vision: boolean;
  g: number;
  ig: number;
  places: number;
};

export type CostEstimate = {
  lines: CostLine[];
  active: CostLine[];
  perPlace: number;
  total: number;
  perPlaceSecs: number;
  totalSecs: number;
};

// Build the per-step rate rows and the aggregate cost/time for one enrichment.
// Every step S1→S9 runs on every enrichment (no tiers) — only the vision rows
// can zero out, when photo analysis is off or no images are analyzed.
export function computeEnrichmentCost({
  quality,
  imageModel,
  vision,
  g,
  ig,
  places,
}: CostParams): CostEstimate {
  const synthCost =
    quality === "economy" ? COST_RATES.synthEconomy : COST_RATES.synthStandard;
  const synthSecs =
    quality === "economy" ? TIME_RATES.synthEconomy : TIME_RATES.synthStandard;
  const visionImgs = vision ? g + ig : 0;
  const visionActive = vision && visionImgs > 0;
  const visionCostPer =
    imageModel === "economy" ? COST_RATES.visionEconomy : COST_RATES.visionStandard;
  const visionSecsPer =
    imageModel === "economy" ? TIME_RATES.visionEconomy : TIME_RATES.visionStandard;

  // Each line: cost (USD) + secs (duration) + stage for the wall-clock model.
  // pre = serial before gather · gather = concurrent · post = serial after.
  const lines: CostLine[] = [
    { label: "S1 · Google profile + timezone", detail: "Places Details lookup", cost: COST_RATES.googlePlaces, secs: TIME_RATES.googlePlaces, stage: "pre", active: true },
    { label: "S2 · SERP summary", detail: "Perplexity agent", cost: COST_RATES.perplexity, secs: TIME_RATES.discoveryFallback, stage: "gather", active: true },
    { label: "S3 · link discovery", detail: "Firecrawl search + footer scrape", cost: COST_RATES.firecrawlSearch + COST_RATES.firecrawlScrape, secs: TIME_RATES.discoverySearch, stage: "pre", active: true },
    { label: "S3 · agent validate + contacts", detail: "3 × Perplexity agent", cost: COST_RATES.perplexity * 3, secs: TIME_RATES.discoveryFallback * 3, stage: "pre", active: true },
    { label: "S4 · Google reviews + photos", detail: "Apify Maps run", cost: COST_RATES.apifyGoogleMaps, secs: TIME_RATES.apifyGoogleMaps, stage: "gather", active: true },
    { label: "S4 · Instagram", detail: "Apify run", cost: COST_RATES.apifyInstagram, secs: TIME_RATES.apifyInstagram, stage: "gather", active: true },
    { label: "S4 · Facebook", detail: "Apify run", cost: COST_RATES.apifyFacebook, secs: TIME_RATES.apifyFacebook, stage: "gather", active: true },
    { label: "S5 · image descriptions", detail: `${visionImgs} img × ${money(visionCostPer)}`, cost: visionImgs * visionCostPer, secs: visionImgs * visionSecsPer, stage: "post", active: visionActive },
    { label: "S6 · image ranking", detail: "1 text sort call", cost: COST_RATES.sort, secs: TIME_RATES.sort, stage: "post", active: visionActive },
    { label: `S7 · About synthesis — ${quality}`, detail: quality === "economy" ? "gpt-4o-mini" : "gpt-4o", cost: synthCost, secs: synthSecs, stage: "post", active: true },
    { label: "S7 · category + tags", detail: "2 × gpt-4o-mini", cost: COST_RATES.sort * 2, secs: TIME_RATES.sort * 2, stage: "post", active: true },
    { label: "S8/S9 · persist data + images", detail: "Edge Functions — no metered cost", cost: 0, secs: 5, stage: "post", active: true },
  ];

  const active = lines.filter((l) => l.active);
  const perPlace = active.reduce((s, l) => s + l.cost, 0);
  const total = perPlace * Math.max(1, places);
  // Wall-clock: serial pre + the SLOWEST concurrent gather + serial post.
  const preSecs = active.filter((l) => l.stage === "pre").reduce((s, l) => s + l.secs, 0);
  const gatherSecs = active
    .filter((l) => l.stage === "gather")
    .reduce((mx, l) => Math.max(mx, l.secs), 0);
  const postSecs = active.filter((l) => l.stage === "post").reduce((s, l) => s + l.secs, 0);
  const perPlaceSecs = preSecs + gatherSecs + postSecs;
  const totalSecs = perPlaceSecs * Math.max(1, places);

  return { lines, active, perPlace, total, perPlaceSecs, totalSecs };
}
