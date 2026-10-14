// Firecrawl web search (v2 /search, the same endpoint linklab uses).
// Returns result URLs best-first; [] on any failure, which is logged.

const SEARCH_URL = "https://api.firecrawl.dev/v2/search";

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
      body: JSON.stringify({ query, limit, sources: [{ type: "web" }] }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const body = (await r.text().catch(() => "")).slice(0, 200);
      console.error(`[firecrawl-search] ${r.status} ${body}`);
      return [];
    }
    // v2 nests web hits under `data.web`. Older shapes put a flat array on
    // `data` or `results`. Accept all three — web first, then news/images.
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
  } catch (err) {
    const why = ctrl.signal.aborted
      ? "timeout after 20000ms"
      : (err instanceof Error ? err.message : String(err)).slice(0, 200);
    console.error(`[firecrawl-search] ${why}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
