// Official links the Google spine did not already have.
// Firecrawl Search is the only source. The Resolver (the Perplexity Agent the
// Enrichment page shows) picks one URL per field, and a URL outside that
// Firecrawl pool is dropped. A count of 0 does not search that source.
// Google's own link is left alone. The Scout's read, when the job carried a Scout message, is
// the Resolver's background on the place: never the source of a URL.

import { charge, firecrawlCredits, FIRECRAWL_USD_PER_CREDIT } from "./cost.ts";
import { channelFromUrl, type GoogleChannel } from "./channels.ts";
import { callAgent } from "./perplexity.ts";
import { completed, failed, type StepReport } from "./steps.ts";

export const LINK_FIELDS = [
  "website_url",
  "instagram_url",
  "facebook_url",
  "opentable_url",
  "uber_eats_url",
] as const;

export type LinkField = (typeof LINK_FIELDS)[number];

export type LinkCounts = Partial<Record<LinkField, number>>;

// What the Enrichment page ships when a run has no knobs: website 5,
// Instagram 7, Facebook 3, OpenTable 3, Uber Eats 3. Each is capped at 10.
const DEFAULT_COUNTS: Record<LinkField, number> = {
  website_url: 5,
  instagram_url: 7,
  facebook_url: 3,
  opentable_url: 3,
  uber_eats_url: 3,
};

const SEARCH_TERM: Record<LinkField, string> = {
  website_url: "official website",
  instagram_url: "instagram",
  facebook_url: "facebook",
  opentable_url: "opentable",
  uber_eats_url: "uber eats",
};

type FetchImpl = typeof fetch;

export function linkCounts(counts?: LinkCounts): Record<LinkField, number> {
  const out = { ...DEFAULT_COUNTS };
  if (!counts) return out;
  for (const field of LINK_FIELDS) {
    const value = counts[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[field] = Math.max(0, Math.min(10, Math.floor(value)));
    }
  }
  return out;
}

export function validateLink(field: LinkField, raw: string): string | null {
  const channel = channelFromUrl(raw);
  if (!channel || channel.key !== (field as GoogleChannel)) return null;
  if (field === "opentable_url") {
    try {
      const path = new URL(channel.url).pathname;
      if (!path.startsWith("/r/")) return null;
    } catch {
      return null;
    }
  }
  if (field === "uber_eats_url" && !channel.url.includes("/store/")) return null;
  return channel.url;
}

export function poolFromUrls(field: LinkField, urls: string[]): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    const url = validateLink(field, raw);
    if (!url || out.some((item) => sameOfficialUrl(item, url))) continue;
    out.push(url);
  }
  return out;
}

// Host and path, ignoring www and a trailing slash. Query strings are not
// identity: a tracking parameter must not make a sourced URL look new.
export function sameOfficialUrl(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    const host = (value: URL) => value.hostname.toLowerCase().replace(/^www\./, "");
    const path = (value: URL) => value.pathname.replace(/\/$/, "") || "/";
    return host(left) === host(right) && path(left) === path(right);
  } catch {
    return false;
  }
}

// The Resolver's pick survives only when it is one of the URLs Firecrawl returned.
export function confirmedLink(field: LinkField, pool: string[], answer: unknown): string | null {
  if (typeof answer !== "string") return null;
  const picked = answer.trim();
  if (!picked || picked.toLowerCase() === "null") return null;
  const valid = validateLink(field, picked);
  if (!valid) return null;
  return pool.find((item) => sameOfficialUrl(item, valid)) ?? null;
}

type DiscoverOptions = {
  name: string;
  city: string | null;
  have: Partial<Record<LinkField, string | null>>;
  counts?: LinkCounts;
  preset?: string;
  instructions?: string;
  /** The Scout's read of the place, when the Scout ran. */
  context?: string | null;
  firecrawlKey?: string;
  perplexityKey?: string;
  fetchImpl?: FetchImpl;
};

export async function discoverOfficialLinks(opts: DiscoverOptions): Promise<Partial<Record<LinkField, string>>> {
  return (await discoverLinks(opts)).links;
}

/** The links found, and step 3's outcome: finding nothing is a result, a
 *  vendor that did not answer is a failure. */
export async function discoverLinks(opts: DiscoverOptions): Promise<{
  links: Partial<Record<LinkField, string>>;
  report: StepReport;
}> {
  const firecrawlKey = opts.firecrawlKey?.trim() ?? "";
  const perplexityKey = opts.perplexityKey?.trim() ?? "";
  const counts = linkCounts(opts.counts);
  const missing = LINK_FIELDS.filter((field) => !opts.have[field] && counts[field] > 0);
  if (!missing.length) return { links: {}, report: completed("Every link was already known; nothing to look for.") };
  if (!firecrawlKey || !perplexityKey) {
    console.error("[links] Firecrawl and Perplexity are both required; no new links");
    return { links: {}, report: failed("Render is missing FIRECRAWL_KEY or PERPLEXITY_KEY, so no link was looked for.") };
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const gathered = await gatherPools(fetchImpl, firecrawlKey, opts.name, opts.city, missing, counts);
    const pools = gathered.pools;
    const judgedFields = missing.filter((field) => (pools[field] ?? []).length > 0);
    if (!judgedFields.length) {
      return gathered.failed === missing.length
        ? { links: {}, report: failed("Firecrawl Search did not answer.") }
        : { links: {}, report: completed("Firecrawl found no candidate links.") };
    }
    const judged = await judgePools(
      fetchImpl,
      perplexityKey,
      opts.name,
      opts.city,
      pools,
      judgedFields,
      opts.preset?.trim() || "pro-search",
      opts.instructions?.trim() ||
        "You are a meticulous reviewer that resolves a place's OWN official online channels. Never fabricate a URL.",
      opts.context?.trim() ?? "",
    );
    if (!judged) return { links: {}, report: failed("The Resolver did not answer.") };
    const found: Partial<Record<LinkField, string>> = {};
    for (const field of judgedFields) {
      const pool = pools[field] ?? [];
      const url = confirmedLink(field, pool, judged.answer[field]) ??
        citedLink(field, pool, judged.hitUrls);
      if (url) found[field] = url;
    }
    const count = Object.keys(found).length;
    return {
      links: found,
      report: completed(count ? `Found ${count} new link(s).` : "The Resolver kept no candidate."),
    };
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[links] ${why.slice(0, 200)}`);
    return { links: {}, report: failed(`Link discovery stopped: ${why.slice(0, 160)}`) };
  }
}

// A citation is a pick only when that URL is already in this field's pool.
// The first candidate is not a pick: an empty answer stays empty.
function citedLink(field: LinkField, pool: string[], hitUrls: string[]): string | null {
  for (const url of hitUrls) {
    const hit = confirmedLink(field, pool, url);
    if (hit) return hit;
  }
  return null;
}

async function gatherPools(
  fetchImpl: FetchImpl,
  apiKey: string,
  name: string,
  city: string | null,
  fields: LinkField[],
  counts: Record<LinkField, number>,
): Promise<{ pools: Partial<Record<LinkField, string[]>>; failed: number }> {
  const scope = [name, city ?? ""].map((part) => part.trim()).filter(Boolean).join(" ");
  const runs = await Promise.all(fields.map((field) =>
    firecrawlSearch(fetchImpl, apiKey, `${scope} ${SEARCH_TERM[field]}`, counts[field])
  ));
  const pools: Partial<Record<LinkField, string[]>> = {};
  fields.forEach((field, index) => {
    pools[field] = poolFromUrls(field, runs[index].urls);
  });
  return { pools, failed: runs.filter((run) => !run.ok).length };
}

async function firecrawlSearch(
  fetchImpl: FetchImpl,
  apiKey: string,
  query: string,
  limit: number,
): Promise<{ urls: string[]; ok: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetchImpl("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit, sources: [{ type: "web" }] }),
        signal: ctrl.signal,
      });
      if (res.status === 429 && attempt === 0) {
        await delay(1000);
        continue;
      }
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 200);
        console.error(`[links] firecrawl ${res.status} ${body}`);
        return { urls: [], ok: false };
      }
      const payload = await res.json();
      const credits = firecrawlCredits(payload, limit);
      charge("firecrawl", credits * FIRECRAWL_USD_PER_CREDIT, `search ${credits} credits`);
      return { urls: urlsFromFirecrawl(payload), ok: true };
    } catch (err) {
      const why = ctrl.signal.aborted
        ? "timeout after 20000ms"
        : (err instanceof Error ? err.message : String(err)).slice(0, 200);
      console.error(`[links] firecrawl ${why}`);
      return { urls: [], ok: false };
    } finally {
      clearTimeout(timer);
    }
  }
  return { urls: [], ok: false };
}

export function urlsFromFirecrawl(payload: unknown): string[] {
  const data = payload && typeof payload === "object" ? (payload as { data?: unknown; results?: unknown }).data : undefined;
  const results = payload && typeof payload === "object" ? (payload as { results?: unknown }).results : undefined;
  const collect = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
  let rows: unknown[];
  if (Array.isArray(data)) rows = data;
  else if (data && typeof data === "object") {
    const nested = data as { web?: unknown; news?: unknown; images?: unknown };
    rows = [...collect(nested.web), ...collect(nested.news), ...collect(nested.images)];
  } else {
    rows = collect(results);
  }
  return rows
    .map((row) => row && typeof (row as { url?: unknown }).url === "string" ? (row as { url: string }).url : "")
    .filter(Boolean);
}

// The background line is the console's own wording (buildResolverInput in
// supabase/.../_shared/enrich-channel-discovery.ts), so a read the Scout
// bought lands in the Resolver's message the way admin Enrichment shows it.
export function resolverBackground(context: string): string {
  const text = context.trim();
  return text
    ? `Background on the place (soft web context — never the source of a URL):\n${text.slice(0, 600)}\n\n`
    : "";
}

async function judgePools(
  fetchImpl: FetchImpl,
  apiKey: string,
  name: string,
  city: string | null,
  pools: Partial<Record<LinkField, string[]>>,
  fields: LinkField[],
  preset: string,
  instructions: string,
  context: string,
): Promise<{ answer: Record<string, unknown>; hitUrls: string[] } | null> {
  const properties: Record<string, { type: string[] }> = {};
  for (const field of fields) properties[field] = { type: ["string", "null"] };
  const where = city?.trim() ? ` in ${city.trim()}` : "";
  const lists = fields.map((field) => {
    const pool = pools[field] ?? [];
    return `${field} candidates:\n${pool.map((url) => `- ${url}`).join("\n")}`;
  }).join("\n");
  const input =
    `Review and select the official channels for the place "${name}"${where}.\n\n` +
    resolverBackground(context) +
    `Candidate URLs found by search — review each and pick the correct one when present:\n${lists}\n\n` +
    "Return strict JSON. Each value is one URL from that field's list, or null. Never invent a URL.";
  return await callAgent({
    apiKey,
    input,
    instructions,
    preset,
    maxSteps: 10,
    schema: {
      type: "object",
      additionalProperties: false,
      properties,
      required: fields,
    },
    tag: "links",
    fetchImpl,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
