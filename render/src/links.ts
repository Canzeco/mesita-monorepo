// Official links the Google spine did not already have.
// Firecrawl Search is the only source. The Resolver (the Perplexity Agent the
// Enrichment page shows) picks one URL per field, and a URL outside that
// Firecrawl pool is dropped. A count of 0 does not search that source.
// Google's own link is left alone.

import { channelFromUrl, type GoogleChannel } from "./channels.ts";

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

const AGENT_URL = "https://api.perplexity.ai/v1/agent";
const AGENT_TIMEOUT_MS = 45_000;

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

export async function discoverOfficialLinks(opts: {
  name: string;
  city: string | null;
  have: Partial<Record<LinkField, string | null>>;
  counts?: LinkCounts;
  preset?: string;
  instructions?: string;
  firecrawlKey?: string;
  perplexityKey?: string;
  fetchImpl?: FetchImpl;
}): Promise<Partial<Record<LinkField, string>>> {
  const firecrawlKey = opts.firecrawlKey?.trim() ?? "";
  const perplexityKey = opts.perplexityKey?.trim() ?? "";
  const counts = linkCounts(opts.counts);
  const missing = LINK_FIELDS.filter((field) => !opts.have[field] && counts[field] > 0);
  if (!missing.length) return {};
  if (!firecrawlKey || !perplexityKey) {
    console.error("[links] Firecrawl and Perplexity are both required; no new links");
    return {};
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const pools = await gatherPools(fetchImpl, firecrawlKey, opts.name, opts.city, missing, counts);
    const judgedFields = missing.filter((field) => (pools[field] ?? []).length > 0);
    if (!judgedFields.length) return {};
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
    );
    if (!judged) return {};
    const found: Partial<Record<LinkField, string>> = {};
    for (const field of judgedFields) {
      const pool = pools[field] ?? [];
      const url = confirmedLink(field, pool, judged.answer[field]) ??
        citedLink(field, pool, judged.hitUrls);
      if (url) found[field] = url;
    }
    return found;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[links] ${why.slice(0, 200)}`);
    return {};
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
): Promise<Partial<Record<LinkField, string[]>>> {
  const scope = [name, city ?? ""].map((part) => part.trim()).filter(Boolean).join(" ");
  const runs = await Promise.all(fields.map((field) =>
    firecrawlSearch(fetchImpl, apiKey, `${scope} ${SEARCH_TERM[field]}`, counts[field])
  ));
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
  preset: string,
  instructions: string,
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
    `Candidate URLs found by search — review each and pick the correct one when present:\n${lists}\n\n` +
    "Return strict JSON. Each value is one URL from that field's list, or null. Never invent a URL.";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(AGENT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        preset,
        instructions,
        max_steps: 10,
        response_format: {
          type: "json_schema",
          json_schema: {
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
    return agentResult(await res.json());
  } catch (err) {
    const why = ctrl.signal.aborted
      ? `timeout after ${AGENT_TIMEOUT_MS}ms`
      : (err instanceof Error ? err.message : String(err)).slice(0, 200);
    console.error(`[links] perplexity ${why}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function agentResult(payload: unknown): { answer: Record<string, unknown>; hitUrls: string[] } {
  const output = payload && typeof payload === "object"
    ? (payload as { output?: { type?: string; content?: { text?: string; annotations?: { url?: unknown }[] }[] }[] }).output
    : undefined;
  let text = "";
  const hitUrls: string[] = [];
  for (const item of output ?? []) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (typeof part?.text === "string") text += part.text;
      for (const note of part?.annotations ?? []) {
        if (note && typeof note.url === "string") hitUrls.push(note.url);
      }
    }
  }
  return { answer: parseJsonObject(text) ?? {}, hitUrls };
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
