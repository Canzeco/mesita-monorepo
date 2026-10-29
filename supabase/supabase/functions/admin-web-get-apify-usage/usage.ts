// Pure half of admin-web-get-apify-usage: which scrapers Mesita runs, and how
// Apify's own run list folds into spend and health per scraper. Apify is the
// source of truth on purpose — it counts the Supabase and the Render callers
// alike, and every run it billed, including ones our side aborted.

import { finiteOrNull } from "../_shared/input.ts";

// Every Apify actor Mesita calls, in the order the page lists them. Keep in
// step with APIFY_ACTORS in _shared/apify.ts and the actors in render/src.
export const SCRAPERS = [
  {
    key: "googleMaps",
    actor: "compass~crawler-google-places",
    label: "Google Maps",
    use: "Google reviews (all of them, plus popular times) for the Enricher and review reloads",
  },
  {
    key: "instagramProfile",
    actor: "apify~instagram-profile-scraper",
    label: "Instagram profile",
    use: "Followers, bio and the first grid of posts; Instagram claim on the consumer app",
  },
  {
    key: "instagramPosts",
    actor: "apify~instagram-post-scraper",
    label: "Instagram posts",
    use: "Instagram images for the gallery (the latest posts, ranked by likes)",
  },
  {
    key: "facebookPages",
    actor: "apify~facebook-pages-scraper",
    label: "Facebook pages",
    use: "Facebook page category and cuisine for the Enricher",
  },
] as const;

export type RunRow = {
  actId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  usageTotalUsd: number | null;
};

export type ScraperStats = {
  key: string;
  actor: string;
  label: string;
  use: string;
  runs: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  aborted: number;
  running: number;
  // Finished runs that succeeded, 0–1. null until one run has finished.
  successRate: number | null;
  spendUsd: number;
  avgCostUsd: number | null;
  avgDurationSec: number | null;
  lastRunAt: string | null;
  lastFailureAt: string | null;
  lastFailureStatus: string | null;
};

// One page of GET /v2/actor-runs. Rows without an actor or a start drop.
export function readRunPage(body: unknown): { rows: RunRow[]; total: number | null } {
  const data = (body as { data?: unknown } | null)?.data as
    | { items?: unknown; total?: unknown }
    | undefined;
  const items = Array.isArray(data?.items) ? data.items : [];
  const rows: RunRow[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.actId !== "string" || typeof r.startedAt !== "string") continue;
    rows.push({
      actId: r.actId,
      status: typeof r.status === "string" ? r.status : "UNKNOWN",
      startedAt: r.startedAt,
      finishedAt: typeof r.finishedAt === "string" ? r.finishedAt : null,
      usageTotalUsd: finiteOrNull(r.usageTotalUsd),
    });
  }
  return { rows, total: finiteOrNull(data?.total) };
}

const FAILURES = new Set(["FAILED", "TIMED-OUT", "TIMING-OUT", "ABORTED", "ABORTING"]);

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

// Folds runs started at or after `sinceMs` into one row per scraper, keyed by
// Apify's internal actor id (`ids` maps scraper key → actId). Runs of actors
// Mesita does not call land in `other` so the page's total still adds up.
export function aggregate(
  runs: RunRow[],
  ids: Record<string, string | null>,
  sinceMs: number,
): { scrapers: ScraperStats[]; other: { runs: number; spendUsd: number } } {
  const byAct = new Map<string, RunRow[]>();
  const other = { runs: 0, spendUsd: 0 };
  const known = new Set(Object.values(ids).filter((v): v is string => !!v));
  for (const run of runs) {
    const t = Date.parse(run.startedAt);
    if (!Number.isFinite(t) || t < sinceMs) continue;
    if (!known.has(run.actId)) {
      other.runs++;
      other.spendUsd += run.usageTotalUsd ?? 0;
      continue;
    }
    const list = byAct.get(run.actId) ?? [];
    list.push(run);
    byAct.set(run.actId, list);
  }

  const scrapers = SCRAPERS.map((s): ScraperStats => {
    const id = ids[s.key];
    const list = (id ? byAct.get(id) : undefined) ?? [];
    let succeeded = 0, failed = 0, timedOut = 0, aborted = 0, running = 0;
    let spend = 0, costed = 0, durTotal = 0, durN = 0;
    let lastRunAt: string | null = null;
    let lastFailureAt: string | null = null;
    let lastFailureStatus: string | null = null;
    for (const r of list) {
      switch (r.status) {
        case "SUCCEEDED": succeeded++; break;
        case "FAILED": failed++; break;
        case "TIMED-OUT": case "TIMING-OUT": timedOut++; break;
        case "ABORTED": case "ABORTING": aborted++; break;
        default: running++;
      }
      if (r.usageTotalUsd !== null) {
        spend += r.usageTotalUsd;
        costed++;
      }
      if (r.finishedAt) {
        const d = Date.parse(r.finishedAt) - Date.parse(r.startedAt);
        if (Number.isFinite(d) && d >= 0) {
          durTotal += d;
          durN++;
        }
      }
      if (!lastRunAt || r.startedAt > lastRunAt) lastRunAt = r.startedAt;
      if (FAILURES.has(r.status) && (!lastFailureAt || r.startedAt > lastFailureAt)) {
        lastFailureAt = r.startedAt;
        lastFailureStatus = r.status;
      }
    }
    const finished = succeeded + failed + timedOut + aborted;
    return {
      key: s.key,
      actor: s.actor,
      label: s.label,
      use: s.use,
      runs: list.length,
      succeeded,
      failed,
      timedOut,
      aborted,
      running,
      successRate: finished > 0 ? round(succeeded / finished, 4) : null,
      spendUsd: round(spend, 4),
      avgCostUsd: costed > 0 ? round(spend / costed, 5) : null,
      avgDurationSec: durN > 0 ? round(durTotal / durN / 1000, 1) : null,
      lastRunAt,
      lastFailureAt,
      lastFailureStatus,
    };
  });

  return { scrapers, other: { runs: other.runs, spendUsd: round(other.spendUsd, 4) } };
}

export type MonthUsage = {
  cycleStart: string | null;
  cycleEnd: string | null;
  spendUsd: number | null;
  limitUsd: number | null;
  daily: { date: string; spendUsd: number }[];
};

// GET /v2/users/me/usage/monthly and /v2/users/me/limits, folded together.
// Either may be null (a failed call); the page then shows what it has.
export function readMonth(usage: unknown, limits: unknown): MonthUsage {
  const u = (usage as { data?: Record<string, unknown> } | null)?.data ?? {};
  const l = (limits as { data?: Record<string, unknown> } | null)?.data ?? {};
  const cycle = (u.usageCycle ?? {}) as Record<string, unknown>;
  const lim = (l.limits ?? {}) as Record<string, unknown>;
  const cur = (l.current ?? {}) as Record<string, unknown>;
  const daily: MonthUsage["daily"] = [];
  if (Array.isArray(u.dailyServiceUsages)) {
    for (const d of u.dailyServiceUsages) {
      if (!d || typeof d !== "object") continue;
      const row = d as Record<string, unknown>;
      const spend = finiteOrNull(row.totalUsageCreditsUsd);
      if (typeof row.date !== "string" || spend === null) continue;
      daily.push({ date: row.date.slice(0, 10), spendUsd: round(spend, 4) });
    }
  }
  daily.sort((a, b) => a.date.localeCompare(b.date));
  return {
    cycleStart: typeof cycle.startAt === "string" ? cycle.startAt : null,
    cycleEnd: typeof cycle.endAt === "string" ? cycle.endAt : null,
    spendUsd: finiteOrNull(u.totalUsageCreditsUsdAfterVolumeDiscount) ??
      finiteOrNull(cur.monthlyUsageUsd) ??
      finiteOrNull(u.totalUsageCreditsUsdBeforeVolumeDiscount),
    limitUsd: finiteOrNull(lim.maxMonthlyUsageUsd),
    daily,
  };
}
