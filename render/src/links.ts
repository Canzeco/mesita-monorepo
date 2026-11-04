// Official links the Google spine did not already have.
// Firecrawl is the only source: Search in the place's own country, plus the
// links on the place's own website. A chain branch ("Starbucks Biblioteca ITESM
// MTY II") rarely has an account of its own, so the brand is searched too: the
// website's host label, when the place name carries it. The Resolver (the
// Perplexity Agent the Enrichment page shows) is the only selector: it picks one
// URL per field from candidates that carry their page title, description and
// origin, and a URL outside that pool is dropped. A count of 0 does not search
// that source. Google's own link joins the pool, so a pick can replace it but a
// null leaves it. The Scout's read, when the job carried a Scout message, is the
// Resolver's background on the place: never the source of a URL.

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

/** One Firecrawl result, before it is held to a field's shape. */
export type Hit = { url: string; title?: string; description?: string; origin?: string };

/** One URL the Resolver may pick, as it reads it. */
export type Candidate = { url: string; line: string };

const POST_PATH = /instagram\.com\/(p|reel|reels|tv)\//i;

// A post in the results names the account behind it ("Foo (@foo) • Instagram
// reel"). That account is a candidate, and the Resolver is told where it came from.
function accountBehindPost(hit: Hit): string | null {
  if (!POST_PATH.test(hit.url)) return null;
  const handle = /\(@([A-Za-z0-9._]{1,30})\)/.exec(`${hit.title ?? ""} ${hit.description ?? ""}`)?.[1];
  return handle ? validateLink("instagram_url", `https://www.instagram.com/${handle}`) : null;
}

export function poolFromHits(field: LinkField, hits: Hit[]): Candidate[] {
  const out: Candidate[] = [];
  for (const hit of hits) {
    const direct = validateLink(field, hit.url);
    const behind = !direct && field === "instagram_url" ? accountBehindPost(hit) : null;
    const url = direct ?? behind;
    if (!url || out.some((item) => sameOfficialUrl(item.url, url))) continue;
    out.push({ url, line: candidateLine(url, behind ? { ...hit, origin: "the account behind a post in the results" } : hit) });
  }
  return out;
}

function candidateLine(url: string, hit: Hit): string {
  const clip = (value: string | undefined, max: number) => value?.replace(/\s+/g, " ").trim().slice(0, max) ?? "";
  const title = clip(hit.title, 100);
  const description = clip(hit.description, 160);
  return `- ${url}` +
    (hit.origin ? ` [${hit.origin}]` : "") +
    (title ? ` — "${title}"` : "") +
    (description ? ` — ${description}` : "");
}

// Host and path, ignoring www and a trailing slash. Query strings are not
// identity: a tracking parameter must not make a sourced URL look new.
export function sameOfficialUrl(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    const host = (value: URL) => value.hostname.toLowerCase().replace(/^www\./, "");
    const path = (value: URL) => value.pathname.replace(/\/$/, "").toLowerCase() || "/";
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
  /** ISO country of the place: Firecrawl searches the US unless told otherwise. */
  country?: string | null;
  /** Google's main type for the place. */
  category?: string | null;
  /** What Google already lists. Its website names a chain's brand and is read for links. */
  google?: Partial<Record<LinkField, string | null>>;
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
    const google = opts.google ?? {};
    const website = google.website_url ?? null;
    const brand = brandFromWebsite(opts.name, website);
    const gathered = await gatherPools(fetchImpl, firecrawlKey, opts, brand, missing, counts);
    const pools = gathered.pools;
    const site = website ?? ownSiteAmong(opts.name, pools.website_url ?? []);
    if (site && missing.some((field) => field !== "website_url")) {
      addSiteLinks(pools, missing, site, await firecrawlSiteLinks(fetchImpl, firecrawlKey, site));
    }
    // Google's link alone leaves nothing to choose.
    const judgedFields = missing.filter((field) => (pools[field] ?? []).some((item) => !isGoogles(field, item.url, google)));
    if (!judgedFields.length) {
      return gathered.failed === missing.length
        ? { links: {}, report: failed("Firecrawl Search did not answer.") }
        : { links: {}, report: completed("Firecrawl found no candidate links.") };
    }
    for (const field of judgedFields) {
      const own = google[field];
      if (!own || (pools[field] ?? []).some((item) => sameOfficialUrl(item.url, own))) continue;
      pools[field] = [...poolFromHits(field, [{ url: own, origin: "Google's listing for this place" }]), ...(pools[field] ?? [])];
    }
    const judged = await callAgent({
      apiKey: perplexityKey,
      input: resolverInput(
        { name: opts.name, city: opts.city, category: opts.category ?? null, brand, context: opts.context?.trim() ?? "" },
        Object.fromEntries(judgedFields.map((field) => [field, (pools[field] ?? []).map((item) => item.line)])),
      ),
      instructions: opts.instructions?.trim() ||
        "You choose a place's official online channels from the candidates given. A chain branch with no account of its own takes the brand's. Never fabricate a URL.",
      preset: opts.preset?.trim() || "pro-search",
      maxSteps: 10,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(judgedFields.map((field) => [field, { type: ["string", "null"] }])),
        required: judgedFields,
      },
      tag: "links",
      fetchImpl,
    });
    if (!judged) return { links: {}, report: failed("The Resolver did not answer.") };
    const found: Partial<Record<LinkField, string>> = {};
    for (const field of judgedFields) {
      const pool = (pools[field] ?? []).map((item) => item.url);
      // The Resolver's null stands. A citation only fills in when no answer came back at all.
      const url = field in judged.answer
        ? confirmedLink(field, pool, judged.answer[field])
        : citedLink(field, pool, judged.hitUrls);
      if (url && !isGoogles(field, url, google)) found[field] = url;
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

function isGoogles(field: LinkField, url: string, google: Partial<Record<LinkField, string | null>>): boolean {
  const own = google[field];
  return !!own && sameOfficialUrl(own, url);
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

// The brand a chain branch belongs to: the website's first host label
// (starbucks.com.mx → "starbucks") when the place's name carries it. A host the
// name does not carry (a group site, a link page) names no brand.
export function brandFromWebsite(name: string, website: string | null): string | null {
  if (!website) return null;
  let label: string;
  try {
    label = new URL(website).hostname.toLowerCase().replace(/^www\./, "").split(".")[0] ?? "";
  } catch {
    return null;
  }
  const fold = (value: string) =>
    value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");
  const key = fold(label);
  const whole = fold(name);
  if (key.length < 4 || !whole.includes(key) || whole === key) return null;
  return label;
}

// The name without a branch's tail: "Taquería Orinoco ( TEC )" → "Taquería
// Orinoco", "Hello Kitty Burgerland - Park Point" → "Hello Kitty Burgerland".
export function coreName(name: string): string {
  const core = name.replace(/\([^)]*\)/g, " ").split(/\s[-–—|]\s/)[0].replace(/\s+/g, " ").trim();
  return core || name.trim();
}

const SOCIAL_SITE: Partial<Record<LinkField, string>> = {
  instagram_url: "instagram.com",
  facebook_url: "facebook.com",
};

// The searches behind one field's pool. A social source also searches its own
// site, on the name without a branch's tail, and a chain branch searches its brand's.
export function searchQueries(field: LinkField, name: string, city: string | null, brand: string | null): string[] {
  const scope = [name, city ?? ""].map((part) => part.trim()).filter(Boolean).join(" ");
  const queries = [`${scope} ${SEARCH_TERM[field]}`];
  const site = SOCIAL_SITE[field];
  if (site) {
    queries.push(`${[coreName(name), city ?? ""].map((part) => part.trim()).filter(Boolean).join(" ")} site:${site}`);
    if (brand) queries.push(`${brand} ${city ?? ""} ${SEARCH_TERM[field]}`.replace(/\s+/g, " ").trim());
  }
  return queries;
}

async function gatherPools(
  fetchImpl: FetchImpl,
  apiKey: string,
  place: { name: string; city: string | null; country?: string | null },
  brand: string | null,
  fields: LinkField[],
  counts: Record<LinkField, number>,
): Promise<{ pools: Partial<Record<LinkField, Candidate[]>>; failed: number }> {
  const runs = await Promise.all(fields.map(async (field) => {
    const searches = await Promise.all(searchQueries(field, place.name, place.city, brand).map((query) =>
      firecrawlSearch(fetchImpl, apiKey, query, counts[field], place.country ?? null)
    ));
    return { hits: searches.flatMap((run) => run.hits), ok: searches.some((run) => run.ok) };
  }));
  const pools: Partial<Record<LinkField, Candidate[]>> = {};
  fields.forEach((field, index) => {
    pools[field] = poolFromHits(field, runs[index].hits);
  });
  return { pools, failed: runs.filter((run) => !run.ok).length };
}

// With no website from Google, the search's first result whose host carries a
// word of the name is the site worth reading. Any other host names no one.
export function ownSiteAmong(name: string, pool: Candidate[]): string | null {
  const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const words = fold(name).split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
  for (const { url } of pool) {
    try {
      const host = fold(new URL(url).hostname).replace(/[^a-z0-9.]/g, "");
      if (words.some((word) => host.includes(word))) return url;
    } catch {
      continue;
    }
  }
  return null;
}

// The site's links go first in each pool. A website's links never answer
// website_url: they point away from it.
function addSiteLinks(
  pools: Partial<Record<LinkField, Candidate[]>>,
  fields: LinkField[],
  site: string,
  links: string[],
): void {
  const origin = `linked from ${site}`;
  for (const field of fields) {
    if (field === "website_url") continue;
    const fromSite = poolFromHits(field, links.map((url) => ({ url, origin })));
    const rest = (pools[field] ?? []).filter((item) => !fromSite.some((own) => sameOfficialUrl(own.url, item.url)));
    pools[field] = [...fromSite, ...rest];
  }
}

async function firecrawlSiteLinks(fetchImpl: FetchImpl, apiKey: string, url: string): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetchImpl("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      // Social links live in the footer, which onlyMainContent would drop.
      body: JSON.stringify({ url, formats: ["links"], onlyMainContent: false, timeout: 25000 }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error(`[links] firecrawl scrape ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return [];
    }
    const payload = await res.json() as { data?: { links?: unknown; metadata?: { creditsUsed?: unknown } } };
    const used = payload.data?.metadata?.creditsUsed;
    const credits = typeof used === "number" && used >= 0 ? used : 1;
    charge("firecrawl", credits * FIRECRAWL_USD_PER_CREDIT, `scrape ${credits} credits`);
    const links = payload.data?.links;
    return Array.isArray(links) ? links.filter((link): link is string => typeof link === "string") : [];
  } catch (err) {
    const why = ctrl.signal.aborted ? "timeout after 30000ms" : (err instanceof Error ? err.message : String(err)).slice(0, 200);
    console.error(`[links] firecrawl scrape ${why}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function firecrawlSearch(
  fetchImpl: FetchImpl,
  apiKey: string,
  query: string,
  limit: number,
  country: string | null,
): Promise<{ hits: Hit[]; ok: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetchImpl("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit, sources: [{ type: "web" }], ...(country ? { country } : {}) }),
        signal: ctrl.signal,
      });
      if (res.status === 429 && attempt === 0) {
        await delay(1000);
        continue;
      }
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 200);
        console.error(`[links] firecrawl ${res.status} ${body}`);
        return { hits: [], ok: false };
      }
      const payload = await res.json();
      const credits = firecrawlCredits(payload, limit);
      charge("firecrawl", credits * FIRECRAWL_USD_PER_CREDIT, `search ${credits} credits`);
      return { hits: hitsFromFirecrawl(payload), ok: true };
    } catch (err) {
      const why = ctrl.signal.aborted
        ? "timeout after 20000ms"
        : (err instanceof Error ? err.message : String(err)).slice(0, 200);
      console.error(`[links] firecrawl ${why}`);
      return { hits: [], ok: false };
    } finally {
      clearTimeout(timer);
    }
  }
  return { hits: [], ok: false };
}

export function hitsFromFirecrawl(payload: unknown): Hit[] {
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
  const text = (value: unknown) => typeof value === "string" ? value : undefined;
  return rows.flatMap((row) => {
    const hit = (row ?? {}) as { url?: unknown; title?: unknown; description?: unknown };
    return typeof hit.url === "string" && hit.url
      ? [{ url: hit.url, title: text(hit.title), description: text(hit.description) }]
      : [];
  });
}

// The console's own wording: buildResolverInput in
// supabase/.../_shared/enrich-channel-discovery.ts renders this same message,
// pinned by twins.test.ts, so admin Enrichment shows what Perplexity receives.
export function resolverBackground(context: string): string {
  const text = context.trim();
  return text
    ? `Background on the place (soft web context — never the source of a URL):\n${text.slice(0, 600)}\n\n`
    : "";
}

export function resolverInput(
  place: { name: string; city: string | null; category: string | null; brand: string | null; context: string },
  candidates: Partial<Record<LinkField, string[]>>,
): string {
  const where = place.city?.trim() ? ` in ${place.city.trim()}` : "";
  const kind = place.category?.trim() ? ` (category: ${place.category.trim()})` : "";
  const lists = Object.entries(candidates).map(([field, lines]) =>
    `${field} candidates:\n${(lines ?? []).join("\n")}`
  ).join("\n");
  return `Review and select the official channels for the place "${place.name}"${where}${kind}.\n\n` +
    resolverBackground(place.context) +
    (place.brand
      ? `This place is a location of the "${place.brand}" brand. If it has no account of its own, ` +
        `the brand's account is the answer, preferring this country's.\n\n`
      : "") +
    `Candidate URLs, each with its page title, description and origin when known:\n${lists}\n\n` +
    "Return strict JSON. Each value is one URL from that field's list, or null. Never invent a URL.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
