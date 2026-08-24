// Shared Firecrawl helpers. Both the place create path
// (`_shared/create-place.ts` / business-web create flows) and the Intaker
// pipeline hit the same two Firecrawl endpoints with the same auth + timeout
// boilerplate; this is the one place that knows how to call them. All calls
// are best-effort — a missing key, a slow page, or a non-2xx response returns
// null/[] so callers degrade gracefully.
// Search lives in firecrawl-search.ts, re-exported below.

const SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";

type FirecrawlScrapeOpts = {
  formats?: string[];
  onlyMainContent?: boolean;
  excludeTags?: string[];
  // Firecrawl-side render timeout (ms), passed through to the API.
  timeout?: number;
  // Our own abort timeout (ms) so a hung connection can't stall the EF.
  signalTimeoutMs?: number;
};

export type FirecrawlScrape = {
  markdown: string;
  html: string;
  links: string[];
  metadata: Record<string, unknown>;
};

// Scrape one URL. Returns the raw fields (markdown / links / metadata); callers
// slice and pick what they need. null on any failure.
export async function firecrawlScrape(
  apiKey: string | undefined,
  url: string | undefined,
  opts: FirecrawlScrapeOpts = {},
): Promise<FirecrawlScrape | null> {
  if (!apiKey || !url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.signalTimeoutMs ?? 30000);
  try {
    const body: Record<string, unknown> = {
      url,
      formats: opts.formats ?? ["markdown"],
      onlyMainContent: opts.onlyMainContent ?? true,
    };
    if (opts.excludeTags) body.excludeTags = opts.excludeTags;
    if (opts.timeout) body.timeout = opts.timeout;
    const r = await fetch(SCRAPE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      data?: {
        markdown?: string;
        html?: string;
        links?: string[];
        metadata?: Record<string, unknown>;
      };
    };
    return {
      markdown: d.data?.markdown ?? "",
      html: d.data?.html ?? "",
      links: Array.isArray(d.data?.links) ? (d.data!.links as string[]) : [],
      metadata: d.data?.metadata ?? {},
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Search (re-export — implementation in firecrawl-search.ts) ─────────────

export { firecrawlSearch } from "./firecrawl-search.ts";
