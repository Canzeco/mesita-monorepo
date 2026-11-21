// Published per-place USD, first paid tier, after Google's free cap (traced
// 2026-11-21). The Cost page renders these lines. Updation's Create and Enrich
// calculator imports the Apify units so it stops using a flat $0.30.
// A page load is not a line: it reads Postgres.

export type CostLine = {
  vendor: string;
  what: string;
  count: number;
  usd: number;
};

export type CostSection = "fixed" | "variable";

export type CostJob = {
  id: "create" | "fast-update" | "deep-update" | "enrich";
  section: CostSection;
  title: string;
  /** Second name for the same run. Not a second charge. */
  alsoCalled?: string;
  when: string;
  note?: string;
  lines: CostLine[];
};

/** Apify Free, compass/crawler-google-places, per event. */
export const MAPS_PLACE_USD = 0.004;
export const MAPS_DETAILS_USD = 0.002;
export const MAPS_REVIEW_USD = 0.0005;
/** Apify Free, facebook-pages-scraper, one page. The old Updation card used $0.01. */
export const FACEBOOK_PAGE_USD = 0.012;

/** One Maps run that asks for reviews. Zero reviews means the run does not fire. */
export function apifyMapsUsd(reviews: number): number {
  if (reviews <= 0) return 0;
  return MAPS_PLACE_USD + MAPS_DETAILS_USD + reviews * MAPS_REVIEW_USD;
}

const CREATE_LINES: CostLine[] = [
  { vendor: "Google", what: "Place Details, Enterprise + Atmosphere", count: 1, usd: 0.025 },
  { vendor: "Google", what: "Time Zone", count: 1, usd: 0.005 },
  { vendor: "Google", what: "Place photo", count: 1, usd: 0.007 },
  { vendor: "OpenAI", what: "Door prompt, gpt-6-luna", count: 1, usd: 0.002 },
];

const FAST_LINES: CostLine[] = [
  { vendor: "Google", what: "Place Details, Enterprise + Atmosphere", count: 1, usd: 0.025 },
  { vendor: "Google", what: "Time Zone", count: 1, usd: 0.005 },
];

const DEEP_UPDATE_LINES: CostLine[] = [
  { vendor: "Google", what: "Place Details, Enterprise (rating and review count)", count: 1, usd: 0.02 },
  { vendor: "Apify", what: "Google Maps, place + details + 100 reviews", count: 1, usd: 0.056 },
  { vendor: "Apify", what: "Instagram profile", count: 1, usd: 0.0026 },
  { vendor: "Apify", what: "Facebook page", count: 1, usd: FACEBOOK_PAGE_USD },
];

const ENRICH_LINES: CostLine[] = [
  { vendor: "Google", what: "Place Details, Enterprise + Atmosphere", count: 1, usd: 0.025 },
  { vendor: "Google", what: "Time Zone", count: 1, usd: 0.005 },
  { vendor: "Google", what: "Place photos", count: 10, usd: 0.07 },
  { vendor: "Google", what: "Place Details, Enterprise (rating and review count)", count: 1, usd: 0.02 },
  { vendor: "Apify", what: "Google Maps, place + details + 100 reviews", count: 1, usd: 0.056 },
  { vendor: "Apify", what: "Instagram profile", count: 1, usd: 0.0026 },
  { vendor: "Apify", what: "Instagram posts", count: 10, usd: 0.027 },
  { vendor: "Apify", what: "Facebook page", count: 1, usd: FACEBOOK_PAGE_USD },
  { vendor: "Firecrawl", what: "Search, five channels", count: 5, usd: 0.038 },
  { vendor: "Firecrawl", what: "Website scrape", count: 1, usd: 0.0038 },
  { vendor: "Perplexity", what: "Agent, Scout and Resolver, fallback rate", count: 2, usd: 0.04 },
  { vendor: "OpenAI", what: "Vision, ranking, synthesis", count: 1, usd: 0.0036 },
];

export const COST_JOBS: CostJob[] = [
  {
    id: "create",
    section: "fixed",
    title: "Create",
    when: "Once per new Google place. It does not start Enrich.",
    lines: CREATE_LINES,
  },
  {
    id: "fast-update",
    section: "variable",
    title: "Fast Update",
    when: "Every 10 new unique viewers.",
    note: "$0.025 of this is Place Details Enterprise + Atmosphere. The call asks for reviews and atmosphere fields, then drops them. The fields it keeps are the $0.020 Enterprise price.",
    lines: FAST_LINES,
  },
  {
    id: "deep-update",
    section: "variable",
    title: "Deep Update",
    when: "Every 50 new unique viewers. Reviews and follower counts. This is not Enrich.",
    note: "About $0.076 when the place has neither Instagram nor Facebook.",
    lines: DEEP_UPDATE_LINES,
  },
  {
    id: "enrich",
    section: "variable",
    title: "Enrich",
    alsoCalled: "Deep Enrich",
    when: "First at 10 unique viewers, then every 300. Website, Instagram, Facebook, and 100 reviews.",
    note: "About $0.262 with no Instagram and no Facebook. Deep Enrich is this same run.",
    lines: ENRICH_LINES,
  },
];

/** Round to the tenth of a cent the page prints. */
export function jobTotal(job: CostJob): number {
  const sum = job.lines.reduce((s, line) => s + line.usd, 0);
  return Math.round(sum * 1000) / 1000;
}

export function jobsIn(section: CostSection): CostJob[] {
  return COST_JOBS.filter((job) => job.section === section);
}

/**
 * Defaults over the first 300 unique viewers. View 10 starts the first Enrich
 * and skips the updates on that view, so Fast Update fires 29 times, not 30.
 */
export function first300Viewers(): { fast: number; deepUpdate: number; enrich: number } {
  const fast = jobTotal(COST_JOBS.find((j) => j.id === "fast-update")!) * 29;
  const deepUpdate = jobTotal(COST_JOBS.find((j) => j.id === "deep-update")!) * 6;
  const enrich = jobTotal(COST_JOBS.find((j) => j.id === "enrich")!);
  return {
    fast: Math.round(fast * 1000) / 1000,
    deepUpdate: Math.round(deepUpdate * 1000) / 1000,
    enrich,
  };
}
