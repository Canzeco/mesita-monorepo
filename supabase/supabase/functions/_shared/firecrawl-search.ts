// Firecrawl web search — extracted from firecrawl.ts.
// Returns result URLs best-first; [] on any failure.

const SEARCH_URL = "https://api.firecrawl.dev/v1/search";

export async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit = 8,
): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(SEARCH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
      signal: ctrl.signal,
    });
    if (!r.ok) return [];
    // Response shape drifted: the current /v1/search API nests results by source
    // under `data` ({ web: [...], news: [...], images: [...] }). Older shapes put
    // a flat array on `data` or `results`. Accept all three so discovery keeps
    // working across versions — web first (what channel discovery wants), then
    // news/images as a fallback.
    const d = (await r.json()) as {
      data?: unknown[] | { web?: unknown[]; news?: unknown[]; images?: unknown[] };
      results?: unknown[];
    };
    const collect = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
    let arr: unknown[];
    if (Array.isArray(d.data)) {
      arr = d.data;
    } else if (d.data && typeof d.data === "object") {
      arr = [...collect(d.data.web), ...collect(d.data.news), ...collect(d.data.images)];
    } else {
      arr = collect(d.results);
    }
    return arr
      .map((x) =>
        x && typeof (x as { url?: unknown }).url === "string" ? (x as { url: string }).url : "",
      )
      .filter(Boolean);
  } catch {
    return [];
  } finally {
    // firecrawlScrape clears its timer; this one never did — the leaked
    // timeout kept a pending abort alive after every search (lint catch).
    clearTimeout(timer);
  }
}
