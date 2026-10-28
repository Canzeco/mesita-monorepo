// What an Enrich run spends, per step (MESITA-2806). Each vendor call charges
// the step it runs in; the run sends the list with its commit (or its stop)
// and the write stores it as one place_enrichment_runs row.
//
// The money is an ESTIMATE from the unit prices below, read on 2026-10-28.
// Perplexity reports its own cost and Firecrawl its own credits, so those two
// follow the vendor; OpenAI is its token usage × the table; Apify's run-sync
// endpoint returns only the dataset, so Apify is results × the Free-plan
// rate. Google Places is not metered (it has a monthly free tier), nor is the
// write's own synthesis call (it runs in the Edge Function, not here).
// Recording only: nothing here caps a run.

import { AsyncLocalStorage } from "node:async_hooks";

export const PRICES_READ_ON = "2026-10-28";

/** USD per 1M tokens. https://openai.com/api/pricing/ */
export const OPENAI_PER_MTOK: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};
/** A model missing from the table is charged at gpt-4o's rate: an
 *  over-estimate beats a silent zero. */
const OPENAI_FALLBACK = OPENAI_PER_MTOK["gpt-4o"];

/** Used only when a Perplexity answer carries no usage.cost.total_cost.
 *  https://docs.perplexity.ai/getting-started/pricing (pro-search: a few
 *  web_search calls at $0.0025 each plus tokens). */
export const PERPLEXITY_CALL_FALLBACK_USD = 0.02;

/** Hobby plan, $19 / 5,000 credits; a search is 2 credits per 10 results.
 *  https://www.firecrawl.dev/pricing */
export const FIRECRAWL_USD_PER_CREDIT = 19 / 5000;

/** Apify Free-plan rates per result.
 *  https://apify.com/apify/instagram-post-scraper ($2.70 / 1k posts)
 *  https://apify.com/apify/instagram-profile-scraper ($2.60 / 1k profiles)
 *  https://apify.com/apify/facebook-pages-scraper ($12 / 1k pages)
 *  https://apify.com/compass/crawler-google-places (place ~$4 / 1k; reviews ~$0.50 / 1k) */
export const APIFY_USD = {
  instagramPost: 2.7 / 1000,
  instagramProfile: 2.6 / 1000,
  facebookPage: 12 / 1000,
  googleMapsPlace: 4 / 1000,
  googleMapsReview: 0.5 / 1000,
};

export type Vendor = "openai" | "perplexity" | "firecrawl" | "apify";
export type Charge = { step: string; vendor: Vendor; usd: number; basis: string };

/** Four decimals, the column's scale (numeric(8,4)). */
export function roundUsd(usd: number): number {
  return Number.isFinite(usd) && usd > 0 ? Math.round(usd * 10000) / 10000 : 0;
}

type OpenAiUsage = { prompt_tokens?: number; completion_tokens?: number } | undefined;

export function openaiUsd(model: string, usage: OpenAiUsage): number {
  const rate = OPENAI_PER_MTOK[model] ?? OPENAI_FALLBACK;
  const input = num(usage?.prompt_tokens);
  const output = num(usage?.completion_tokens);
  return (input * rate.input + output * rate.output) / 1_000_000;
}

/** Perplexity's own figure when it sends one, else the per-call fallback. */
export function perplexityUsd(payload: unknown): { usd: number; reported: boolean } {
  const cost = (payload as { usage?: { cost?: { total_cost?: unknown } } } | null)?.usage?.cost?.total_cost;
  return typeof cost === "number" && Number.isFinite(cost) && cost >= 0
    ? { usd: cost, reported: true }
    : { usd: PERPLEXITY_CALL_FALLBACK_USD, reported: false };
}

/** Firecrawl's creditsUsed when present, else 2 credits per 10 results asked. */
export function firecrawlCredits(payload: unknown, limit: number): number {
  const used = (payload as { creditsUsed?: unknown } | null)?.creditsUsed;
  if (typeof used === "number" && Number.isFinite(used) && used >= 0) return used;
  return Math.max(1, Math.ceil(Math.max(0, limit) / 10)) * 2;
}

/** The Sync Edge Function's Apify runs, read off its per-source statuses. */
export function syncSourcesUsd(sources: unknown, reviewCount: number): { usd: number; basis: string } {
  const synced = new Set(
    (Array.isArray(sources) ? sources : [])
      .filter((row) => (row as { status?: unknown })?.status === "synced")
      .map((row) => (row as { source?: unknown }).source),
  );
  let usd = 0;
  const parts: string[] = [];
  if (synced.has("google_reviews")) {
    usd += APIFY_USD.googleMapsPlace + reviewCount * APIFY_USD.googleMapsReview;
    parts.push(`google_reviews:${reviewCount}`);
  }
  if (synced.has("instagram")) {
    usd += APIFY_USD.instagramProfile;
    parts.push("instagram");
  }
  if (synced.has("facebook")) {
    usd += APIFY_USD.facebookPage;
    parts.push("facebook");
  }
  return { usd, basis: parts.join(" ") || "none" };
}

/** Every charge one run made. */
export class CostLedger {
  readonly charges: Charge[] = [];

  add(charge: Charge): void {
    if (charge.usd > 0) this.charges.push(charge);
  }

  totalUsd(): number {
    return roundUsd(this.charges.reduce((sum, c) => sum + c.usd, 0));
  }

  /** What the write stores: one entry per step and vendor, rounded. */
  byStep(): { step: string; vendor: Vendor; usd: number; calls: number }[] {
    const rows = new Map<string, { step: string; vendor: Vendor; usd: number; calls: number }>();
    for (const c of this.charges) {
      const key = `${c.step}/${c.vendor}`;
      const row = rows.get(key) ?? { step: c.step, vendor: c.vendor, usd: 0, calls: 0 };
      row.usd += c.usd;
      row.calls += 1;
      rows.set(key, row);
    }
    return [...rows.values()].map((row) => ({ ...row, usd: roundUsd(row.usd) }));
  }
}

const current = new AsyncLocalStorage<{ ledger: CostLedger; step: string }>();

/** Runs `work` with its vendor calls charged to `step` on `ledger`. Two
 *  places run at once, so the step rides the async context, not a global. */
export function inStep<T>(ledger: CostLedger, step: string, work: () => Promise<T>): Promise<T> {
  return current.run({ ledger, step }, work);
}

/** Charges the step this call runs in. Outside a run it is a no-op. */
export function charge(vendor: Vendor, usd: number, basis: string): void {
  const at = current.getStore();
  if (at) at.ledger.add({ step: at.step, vendor, usd, basis });
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
