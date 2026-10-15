// Official links the Google spine did not already have.
// Firecrawl Search is the only source. Perplexity judges that pool and may
// not introduce a URL. A URL outside the pool, or one that fails the channel
// shape, is a false positive and is dropped.

import { channelFromUrl, type GoogleChannel } from "./channels.ts";

export const LINK_FIELDS = [
  "website_url",
  "instagram_url",
  "facebook_url",
  "opentable_url",
  "uber_eats_url",
] as const;

export type LinkField = (typeof LINK_FIELDS)[number];

const SEARCH_LIMIT: Record<LinkField, number> = {
  website_url: 5,
  instagram_url: 5,
  facebook_url: 5,
  opentable_url: 3,
  uber_eats_url: 2,
};

const SEARCH_TERM: Record<LinkField, string> = {
  website_url: "official website",
  instagram_url: "instagram",
  facebook_url: "facebook",
  opentable_url: "opentable",
  uber_eats_url: "uber eats",
};

type FetchImpl = typeof fetch;

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

// The judge's pick survives only when it is one of the URLs Firecrawl returned.
export function confirmedLink(field: LinkField, pool: string[], answer: unknown): string | null {
  if (typeof answer !== "string") return null;
  const picked = answer.trim();
  if (!picked || picked.toLowerCase() === "null") return null;
  const valid = validateLink(field, picked);
  if (!valid) return null;
  return pool.find((item) => sameOfficialUrl(item, valid)) ?? null;
}

export async function discoverOfficialLinks(opts: {
  name: string;
  city: string | null;
  have: Partial<Record<LinkField, string | null>>;
  firecrawlKey?: string;
  perplexityKey?: string;
  fetchImpl?: FetchImpl;
}): Promise<Partial<Record<LinkField, string>>> {
  const firecrawlKey = opts.firecrawlKey?.trim() ?? "";
  const perplexityKey = opts.perplexityKey?.trim() ?? "";
  const missing = LINK_FIELDS.filter((field) => !opts.have[field]);
  if (!missing.length) return {};
  if (!firecrawlKey || !perplexityKey) {
    console.error("[links] Firecrawl and Perplexity are both required; no new links");
    return {};
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const pools = await gatherPools(fetchImpl, firecrawlKey, opts.name, opts.city, missing);
    const judgedFields = missing.filter((field) => (pools[field] ?? []).length > 0);
    if (!judgedFields.length) return {};
    const answer = await judgePools(fetchImpl, perplexityKey, opts.name, opts.city, pools, judgedFields);
    const found: Partial<Record<LinkField, string>> = {};
    for (const field of judgedFields) {
      const url = confirmedLink(field, pools[field] ?? [], answer?.[field]);
      if (url) found[field] = url;
    }
    return found;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[links] ${why.slice(0, 200)}`);
    return {};
  }
}

async function gatherPools(
  fetchImpl: FetchImpl,
  apiKey: string,
  name: string,
  city: string | null,
  fields: LinkField[],
): Promise<Partial<Record<LinkField, string[]>>> {
  const scope = [name, city ?? ""].map((part) => part.trim()).filter(Boolean).join(" ");
  const runs = await Promise.all(fields.map(async (field) => {
    const limit = SEARCH_LIMIT[field];
    const primary = await firecrawlSearch(fetchImpl, apiKey, `${scope} ${SEARCH_TERM[field]}`, limit);
    if (field !== "instagram_url") return primary;
    const alt = await firecrawlSearch(fetchImpl, apiKey, `"${name}" site:instagram.com`, limit);
    return [...primary, ...alt];
  }));
  const pools: Partial<Record<LinkField, string[]>> = {};
  fields.forEach((field, index) => {
    pools[field] = poolFromUrls(field, runs[index]);
  });
  return pools;
}

async function firecrawlSearch(
  fetchImpl: FetchImpl,
  apiKey: string,
  query: string,
  limit: number,
): Promise<string[]> {
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
        return [];
      }
      return urlsFromFirecrawl(await res.json());
    } catch (err) {
      const why = ctrl.signal.aborted
        ? "timeout after 20000ms"
        : (err instanceof Error ? err.message : String(err)).slice(0, 200);
      console.error(`[links] firecrawl ${why}`);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
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

async function judgePools(
  fetchImpl: FetchImpl,
  apiKey: string,
  name: string,
  city: string | null,
  pools: Partial<Record<LinkField, string[]>>,
  fields: LinkField[],
): Promise<Record<string, unknown> | null> {
  const properties: Record<string, { type: string[] }> = {};
  for (const field of fields) properties[field] = { type: ["string", "null"] };
  const lists = fields.map((field) => {
    const pool = pools[field] ?? [];
    return `${field}:\n${pool.map((url) => `- ${url}`).join("\n")}`;
  }).join("\n");
  const where = city?.trim() ? ` in ${city.trim()}` : "";
  const user =
    `Place: "${name}"${where}.\n` +
    "These URLs were found by search. For each field, return the one URL that is " +
    "this place's own official page, or null.\n" +
    "Return null for a different business, a different city, a directory, a best-of list, " +
    "a review site, a parent group, or a fan account.\n" +
    "Return only a URL from that field's list. Never invent one.\n\n" +
    lists;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetchImpl("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        disable_search: true,
        messages: [
          {
            role: "system",
            content: "You reject false positives among candidate URLs. Output only JSON matching the schema.",
          },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "official_links",
            schema: {
              type: "object",
              additionalProperties: false,
              properties,
              required: fields,
            },
          },
        },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      console.error(`[links] perplexity ${res.status} ${body}`);
      return null;
    }
    const body = await res.json() as { choices?: { message?: { content?: string } }[] };
    return parseJsonObject(body.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    const why = ctrl.signal.aborted
      ? "timeout after 30000ms"
      : (err instanceof Error ? err.message : String(err)).slice(0, 200);
    console.error(`[links] perplexity ${why}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const tryParse = (value: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  };
  return tryParse(trimmed) ?? (() => {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return tryParse(trimmed.slice(start, end + 1));
  })();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
