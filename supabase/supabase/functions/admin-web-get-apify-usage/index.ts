// Supabase Edge Function — admin-web-get-apify-usage
//
// Apify spend and run health per scraper, for the Billing page (MESITA-2852).
// Super-admin only, read-only: it lists runs Apify already billed and never
// starts one. The APIFY_KEY stays here; the console never calls Apify itself.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { aggregate, readMonth, readRunPage, type RunRow, SCRAPERS } from "./usage.ts";

const APIFY = "https://api.apify.com/v2";
const PAGE = 1000;
// 10k runs is far beyond a month of Mesita traffic; the cap only stops a
// runaway loop from walking an account's whole history.
const MAX_PAGES = 10;
const DAY_MS = 86_400_000;

async function apifyGet(
  key: string,
  path: string,
): Promise<{ ok: true; body: unknown } | { ok: false; status: number | null; error: string }> {
  const url = new URL(`${APIFY}${path}`);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: text.slice(0, 200) || `Apify returned ${res.status}` };
    }
    return { ok: true, body: text ? JSON.parse(text) : null };
  } catch (err) {
    return { ok: false, status: null, error: err instanceof Error ? err.message : "request failed" };
  }
}

// Newest first until a page reaches past the window.
async function listRuns(key: string, sinceMs: number) {
  const rows: RunRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await apifyGet(key, `/actor-runs?desc=1&limit=${PAGE}&offset=${page * PAGE}`);
    if (!r.ok) return { ok: false as const, error: r.error, status: r.status };
    const parsed = readRunPage(r.body);
    rows.push(...parsed.rows);
    const oldest = parsed.rows.at(-1);
    if (parsed.rows.length < PAGE || !oldest || Date.parse(oldest.startedAt) < sinceMs) {
      return { ok: true as const, rows, truncated: false };
    }
  }
  return { ok: true as const, rows, truncated: true };
}

serveJson("admin-web-get-apify-usage", async (req) => {
  const ctx = await requireAdminRequest(req, "POST", "Only admins can read Apify usage.");
  if (ctx instanceof Response) return ctx;

  const key = Deno.env.get("APIFY_KEY")?.trim();
  if (!key) return json({ ok: false, error: "APIFY_KEY is not set on the Edge Functions" }, 500);

  const body = await readJsonOr<{ days?: unknown }>(req, {});
  const days = typeof body.days === "number" && [1, 7, 30, 90].includes(body.days) ? body.days : 30;
  const sinceMs = Date.now() - days * DAY_MS;

  // Apify keys runs by an internal actor id, so resolve each scraper's name.
  const [idPairs, runs, usage, limits] = await Promise.all([
    Promise.all(SCRAPERS.map(async (s) => {
      const r = await apifyGet(key, `/acts/${s.actor}`);
      const id = r.ok ? (r.body as { data?: { id?: unknown } } | null)?.data?.id : null;
      return [s.key, typeof id === "string" ? id : null] as const;
    })),
    listRuns(key, sinceMs),
    apifyGet(key, "/users/me/usage/monthly"),
    apifyGet(key, "/users/me/limits"),
  ]);

  if (!runs.ok) {
    const why = runs.status ? `${runs.status} ${runs.error}` : runs.error;
    return json({ ok: false, error: `Apify run list failed: ${why}` }, 502);
  }

  const { scrapers, other } = aggregate(runs.rows, Object.fromEntries(idPairs), sinceMs);
  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    days,
    truncated: runs.truncated,
    month: readMonth(usage.ok ? usage.body : null, limits.ok ? limits.body : null),
    scrapers,
    other,
  });
});
