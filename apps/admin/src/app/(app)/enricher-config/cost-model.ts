import type { SynthesisQuality } from "./actions";

// Cost estimate — the pure model behind the calculator + the inline cost card.
//
// Per-call USD rate card, sourced from each provider's PUBLISHED price list
// (verified 2026-07-07). MIRRORS the cost constants in the enricher
// (`_shared/enrich-config.ts` `COST`). Approximate — enough to compare
// configurations and bound spend, not for billing. Keep in sync with the
// enricher. Each line below carries `fields` (what the call fetches / the SKU or
// model), `pricing` (the published unit rate) and `note` (how the per-call cost
// is derived) so the breakdown table doubles as living cost documentation.
//
// Sources:
//   • Google Maps Platform pricing list (Places API New, first volume tier):
//     Place Details Enterprise+Atmosphere $25/1k · Place Photo $7/1k ·
//     Time Zone API $5/1k.
//   • Apify Store actor pages (pay-per-event): compass/crawler-google-places
//     $1.50/1k places + reviews $0.50/100 + place details $0.20/place ·
//     apify/instagram-profile-scraper $2.60/1k · apify/instagram-post-scraper
//     $2.70/1k · apify/facebook-pages-scraper $10/1k pages.
//   • Firecrawl pricing: /search 2 credits / 10 results (~$0.0008/credit, Std).
//   • Perplexity pricing: Agent API web-search $0.005/call + sonar tokens.
//   • OpenAI pricing: gpt-4o $2.50/$10 per 1M in/out · gpt-4o-mini $0.15/$0.60.
const COST_RATES = {
  // Google — Places API (New), Place Details. Field mask requests reviews +
  // editorialSummary + generativeSummary + reviewSummary → billed at the
  // Enterprise+Atmosphere SKU ($25/1k), NOT Pro ($17/1k).
  googleDetails: 0.025,
  googlePhoto: 0.007, // Place Photo (New) media fetch, $7/1k, per photo
  googleTimezone: 0.005, // Time Zone API, $5/1k
  // Apify Google Maps (compass) run: base place + place-details add-on + up to
  // maxReviews:100 @ $0.50/100. Representative ~55 reviews; caps ~$0.65 at 100.
  apifyGoogleMaps: 0.3,
  apifyInstagramProfile: 0.0026, // IG profile scraper, $2.60/1k results
  apifyInstagramPost: 0.0027, // IG post scraper, $2.70/1k results, per post pulled
  apifyInstagramVerify: 0.01, // identity check: Perplexity fallback + 2nd scrape (worst case)
  apifyFacebook: 0.01, // FB pages scraper, $10/1k pages, one page
  firecrawlSearchPerField: 0.001, // one channel-discovery search (~1–2 credits)
  perplexityAgent: 0.01, // Perplexity Agent call: web search $0.005 + sonar tokens
  visionEconomy: 0.001, // gpt-4o-mini vision, one image (detail:low)
  visionStandard: 0.008, // gpt-4o vision, one image
  sort: 0.001, // gpt-4o-mini text sort / short judge
  synthEconomy: 0.002, // gpt-4o-mini synthesis (~1000-word About)
  synthStandard: 0.028, // gpt-4o synthesis (standard & high)
} as const;

// The five link-discovery channels, in config order. Each channel with a
// candidate count > 0 fires one Firecrawl Search; a 0 disables it.
export const LINK_CHANNELS = [
  "website",
  "instagram",
  "facebook",
  "opentable",
  "ubereats",
] as const;
export type LinkChannel = (typeof LINK_CHANNELS)[number];
export type LinkCounts = Record<LinkChannel, number>;

// Rough wall-clock seconds per step. The gather steps overlap (the enricher
// fires them with Promise.all), so the per-place total uses the stage model
// (pre + max(gather) + post), NOT the column sum.
const TIME_RATES = {
  googleBasics: 3, // Places Details + photo media + timezone
  apifyGoogleMaps: 45, // Apify reviews + images — the slow one
  discoverySearch: 6, // Firecrawl search across channels
  discoveryAgent: 5, // Perplexity Agent (SERP / validate)
  apifyInstagram: 25, // Apify IG profile + posts run
  apifyFacebook: 15, // Apify FB run
  visionEconomy: 1.0, // gpt-4o-mini vision / image
  visionStandard: 1.8, // gpt-4o vision / image
  sort: 3, // text sort
  synthEconomy: 6, // gpt-4o-mini synthesis
  synthStandard: 12, // gpt-4o synthesis
} as const;

// Vision describes every analyzed image CONCURRENTLY (the enricher fires the
// whole analyze pool at once — see _shared/enrich-image-funnel.ts). Up to 40
// run in flight; the analyze caps top out at 60 (Google ≤10 + Instagram ≤50),
// so a typical config is one round and the absolute max is two — analysis time
// ≈ one describe (or two), not N of them.
const VISION_CONCURRENCY = 40;

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
  // What the call fetches + the exact SKU / model it bills as.
  detail: string;
  // The published unit rate this cost is derived from (documentation).
  pricing: string;
  // How the per-place cost is computed from the unit rate (documentation).
  note: string;
  cost: number;
  secs: number;
  stage: Stage;
  active: boolean;
};

export type CostParams = {
  // Models box.
  quality: SynthesisQuality; // profile text model
  imageModel: SynthesisQuality; // image vision model
  // Images box — Collection (candidate pool per source) + Analysis (how many
  // of each pool the vision model reads; also what gets kept).
  gCollect: number; // Google collect (1–10) → Place Photo fetches
  igCollect: number; // Instagram collect (1–50) → Apify posts pulled
  gAnalyze: number; // Analyze Google (0–10, ≤ collect) → vision calls
  igAnalyze: number; // Analyze Instagram (0–30, ≤ collect) → vision calls
  // Links box — per-channel Firecrawl Search candidate counts (0 disables).
  links: LinkCounts;
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
// Every step S1→S9 runs on every enrichment (no tiers). Rows scale with the
// live config knobs — Collection drives the Google-photo & IG-post volumes,
// Links drives how many channels are searched, and Analysis drives the vision
// calls (which zero out only when both analyze counts are 0).
export function computeEnrichmentCost({
  quality,
  imageModel,
  gCollect,
  igCollect,
  gAnalyze,
  igAnalyze,
  links,
  places,
}: CostParams): CostEstimate {
  const synthCost =
    quality === "economy" ? COST_RATES.synthEconomy : COST_RATES.synthStandard;
  const synthSecs =
    quality === "economy" ? TIME_RATES.synthEconomy : TIME_RATES.synthStandard;
  const visionImgs = gAnalyze + igAnalyze;
  const visionActive = visionImgs > 0;
  const visionCostPer =
    imageModel === "economy" ? COST_RATES.visionEconomy : COST_RATES.visionStandard;
  const visionSecsPer =
    imageModel === "economy" ? TIME_RATES.visionEconomy : TIME_RATES.visionStandard;

  const googlePhotoCost = COST_RATES.googlePhoto * gCollect;
  const igApifyCost =
    COST_RATES.apifyInstagramProfile +
    COST_RATES.apifyInstagramPost * igCollect +
    COST_RATES.apifyInstagramVerify;
  const enabledChannels = LINK_CHANNELS.filter((c) => links[c] > 0).length;
  const discoverySearchCost = COST_RATES.firecrawlSearchPerField * enabledChannels;
  const discoveryActive = enabledChannels > 0;

  // Each line: cost (USD) + secs (duration) + stage for the wall-clock model.
  // pre = serial before gather · gather = concurrent · post = serial after.
  const lines: CostLine[] = [
    {
      label: "S1 · Google profile",
      detail: "Places Details — Enterprise+Atmosphere SKU",
      pricing: "$25 / 1k calls",
      note: "1 call · field mask pulls reviews + editorial/generative summaries → Atmosphere tier",
      cost: COST_RATES.googleDetails,
      secs: TIME_RATES.googleBasics,
      stage: "pre",
      active: true,
    },
    {
      label: "S1 · Google photos",
      detail: "Place Photo media fetch",
      pricing: "$7 / 1k photos",
      note: `Google collect = ${gCollect} photo${gCollect === 1 ? "" : "s"} fetched (≤10 refs) × $0.007`,
      cost: googlePhotoCost,
      secs: 0,
      stage: "pre",
      active: true,
    },
    {
      label: "S1 · Timezone",
      detail: "Time Zone API",
      pricing: "$5 / 1k calls",
      note: "1 call from the place lat/lng",
      cost: COST_RATES.googleTimezone,
      secs: 0,
      stage: "pre",
      active: true,
    },
    {
      label: "S2 · SERP summary",
      detail: "Perplexity Agent X (pro-search)",
      pricing: "$0.005 search + tokens",
      note: "1 agent call · web search + sonar tokens",
      cost: COST_RATES.perplexityAgent,
      secs: TIME_RATES.discoveryAgent,
      stage: "gather",
      active: true,
    },
    {
      label: "S3 · link discovery",
      detail: "Firecrawl Search × channels",
      pricing: "2 credits / 10 results",
      note: discoveryActive
        ? `${enabledChannels} of ${LINK_CHANNELS.length} channels enabled (~1–2 credits each)`
        : "all channels disabled (Links all 0)",
      cost: discoverySearchCost,
      secs: TIME_RATES.discoverySearch,
      stage: "pre",
      active: discoveryActive,
    },
    {
      label: "S3 · agent validate + contacts",
      detail: "Perplexity Agent Y (pro-search)",
      pricing: "$0.005 search + tokens",
      note: "1 agent call · selects links + phone/email",
      cost: COST_RATES.perplexityAgent,
      secs: TIME_RATES.discoveryAgent,
      stage: "pre",
      active: discoveryActive,
    },
    {
      label: "S4 · Google reviews + images",
      detail: "Apify compass/crawler-google-places",
      pricing: "$1.50/1k + $0.50/100 reviews",
      note: "base place + details add-on + up to 100 reviews (maxReviews:100); ~$0.65 worst case",
      cost: COST_RATES.apifyGoogleMaps,
      secs: TIME_RATES.apifyGoogleMaps,
      stage: "gather",
      active: true,
    },
    {
      label: "S4 · Instagram",
      detail: "Apify IG profile + post scrapers",
      pricing: "$2.60/1k + $2.70/1k posts",
      note: `profile + Instagram collect = ${igCollect} post${igCollect === 1 ? "" : "s"} pulled + identity verify`,
      cost: igApifyCost,
      secs: TIME_RATES.apifyInstagram,
      stage: "gather",
      active: true,
    },
    {
      label: "S4 · Facebook",
      detail: "Apify facebook-pages-scraper",
      pricing: "$10 / 1k pages",
      note: "1 page",
      cost: COST_RATES.apifyFacebook,
      secs: TIME_RATES.apifyFacebook,
      stage: "gather",
      active: true,
    },
    {
      label: "S5 · image descriptions",
      detail: imageModel === "economy" ? "gpt-4o-mini vision" : "gpt-4o vision",
      pricing:
        imageModel === "economy" ? "~$0.001 / image" : "~$0.008 / image",
      note: `Analyze ${gAnalyze} Google + ${igAnalyze} Instagram = ${visionImgs} image${visionImgs === 1 ? "" : "s"} × ${money(visionCostPer)}, described in parallel (${Math.ceil(visionImgs / VISION_CONCURRENCY) || 0} round${Math.ceil(visionImgs / VISION_CONCURRENCY) === 1 ? "" : "s"})`,
      cost: visionImgs * visionCostPer,
      // Parallel: the whole analyze pool is described at once, so time is the
      // number of rounds (≈1) × per-image, not N × per-image.
      secs: Math.ceil(visionImgs / VISION_CONCURRENCY) * visionSecsPer,
      stage: "post",
      active: visionActive,
    },
    {
      label: "S6 · image ranking",
      detail: "gpt-4o-mini text sort",
      pricing: "~$0.001 / call",
      note: "1 sort call over the analyzed images",
      cost: COST_RATES.sort,
      secs: TIME_RATES.sort,
      stage: "post",
      active: visionActive,
    },
    {
      label: `S7 · About synthesis — ${quality}`,
      detail: quality === "economy" ? "gpt-4o-mini" : "gpt-4o",
      pricing: quality === "economy" ? "$0.15/$0.60 per 1M" : "$2.50/$10 per 1M",
      note: "~1000-word About from gathered sources (no web)",
      cost: synthCost,
      secs: synthSecs,
      stage: "post",
      active: true,
    },
    {
      label: "S7 · category + tags",
      detail: "2 × gpt-4o-mini",
      pricing: "~$0.001 / call",
      note: "2 short classification calls over the closed vocab",
      cost: COST_RATES.sort * 2,
      secs: TIME_RATES.sort * 2,
      stage: "post",
      active: true,
    },
    {
      label: "S8/S9 · persist data + images",
      detail: "Edge Functions + Supabase Storage",
      pricing: "no metered cost",
      note: "DB writes + image mirroring — not separately billed",
      cost: 0,
      secs: 5,
      stage: "post",
      active: true,
    },
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
