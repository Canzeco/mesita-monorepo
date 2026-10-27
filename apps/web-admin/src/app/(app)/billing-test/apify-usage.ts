// Shape of admin-web-get-apify-usage, plus the coercion the panel needs so a
// half-shaped EF response renders instead of throwing.

export const APIFY_WINDOWS = [1, 7, 30, 90] as const;
export type ApifyWindow = (typeof APIFY_WINDOWS)[number];

export type ApifyScraper = {
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
  successRate: number | null;
  spendUsd: number;
  avgCostUsd: number | null;
  avgDurationSec: number | null;
  lastRunAt: string | null;
  lastFailureAt: string | null;
  lastFailureStatus: string | null;
};

export type ApifyUsage = {
  checkedAt: string;
  days: number;
  truncated: boolean;
  month: {
    cycleStart: string | null;
    cycleEnd: string | null;
    spendUsd: number | null;
    limitUsd: number | null;
    daily: { date: string; spendUsd: number }[];
  };
  scrapers: ApifyScraper[];
  other: { runs: number; spendUsd: number };
};

type Row = Record<string, unknown>;
const obj = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});
const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function coerceApifyUsage(raw: unknown): ApifyUsage {
  const r = obj(raw);
  const month = obj(r.month);
  const other = obj(r.other);
  return {
    checkedAt: s(r.checkedAt) ?? new Date().toISOString(),
    days: n(r.days) ?? 30,
    truncated: r.truncated === true,
    month: {
      cycleStart: s(month.cycleStart),
      cycleEnd: s(month.cycleEnd),
      spendUsd: n(month.spendUsd),
      limitUsd: n(month.limitUsd),
      daily: Array.isArray(month.daily)
        ? month.daily.flatMap((d) => {
          const row = obj(d);
          const date = s(row.date);
          const spend = n(row.spendUsd);
          return date && spend !== null ? [{ date, spendUsd: spend }] : [];
        })
        : [],
    },
    scrapers: Array.isArray(r.scrapers)
      ? r.scrapers.flatMap((x) => {
        const row = obj(x);
        const key = s(row.key);
        if (!key) return [];
        return [{
          key,
          actor: s(row.actor) ?? "",
          label: s(row.label) ?? key,
          use: s(row.use) ?? "",
          runs: n(row.runs) ?? 0,
          succeeded: n(row.succeeded) ?? 0,
          failed: n(row.failed) ?? 0,
          timedOut: n(row.timedOut) ?? 0,
          aborted: n(row.aborted) ?? 0,
          running: n(row.running) ?? 0,
          successRate: n(row.successRate),
          spendUsd: n(row.spendUsd) ?? 0,
          avgCostUsd: n(row.avgCostUsd),
          avgDurationSec: n(row.avgDurationSec),
          lastRunAt: s(row.lastRunAt),
          lastFailureAt: s(row.lastFailureAt),
          lastFailureStatus: s(row.lastFailureStatus),
        }];
      })
      : [],
    other: { runs: n(other.runs) ?? 0, spendUsd: n(other.spendUsd) ?? 0 },
  };
}
