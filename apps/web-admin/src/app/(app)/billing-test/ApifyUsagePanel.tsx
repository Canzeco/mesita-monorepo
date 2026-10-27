"use client";

import { useState } from "react";
import { Bug, RefreshCw } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Button, ChoicePill, SectionCard } from "@/components/admin-ui/config";
import type { ActionResult } from "@/lib/action-result";
import { getApifyUsage } from "./actions";
import { APIFY_WINDOWS, type ApifyScraper, type ApifyUsage, type ApifyWindow } from "./apify-usage";

const usd = (v: number | null, digits = 2) => (v === null ? "—" : `$${v.toFixed(digits)}`);
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
const secs = (v: number | null) =>
  v === null ? "—" : v >= 60 ? `${Math.floor(v / 60)}m ${Math.round(v % 60)}s` : `${v}s`;

function rateTone(rate: number | null): string {
  if (rate === null) return "text-muted-foreground";
  if (rate >= 0.95) return "text-emerald-700";
  if (rate >= 0.8) return "text-amber-700";
  return "text-destructive";
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-border/60 bg-muted/30 rounded-xl border p-3">
      <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="font-display mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-muted-foreground type-meta mt-0.5">{hint}</p> : null}
    </div>
  );
}

function DailyBars({ daily }: { daily: ApifyUsage["month"]["daily"] }) {
  if (daily.length === 0) return null;
  const max = Math.max(...daily.map((d) => d.spendUsd), 0.0001);
  return (
    <div>
      <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
        Spend per day, this billing cycle
      </p>
      <div className="mt-2 flex h-20 items-end gap-0.5">
        {daily.map((d) => (
          <div
            key={d.date}
            title={`${d.date} · ${usd(d.spendUsd, 3)}`}
            className="bg-foreground/70 hover:bg-foreground min-h-px flex-1 rounded-sm"
            style={{ height: `${(d.spendUsd / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="text-muted-foreground type-meta mt-1 flex justify-between">
        <span>{daily[0].date}</span>
        <span>{daily[daily.length - 1].date}</span>
      </div>
    </div>
  );
}

function ScraperCard({ s }: { s: ApifyScraper }) {
  const problems = s.failed + s.timedOut + s.aborted;
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-sm font-semibold tracking-tight">{s.label}</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{s.use}</p>
          <p className="text-muted-foreground/80 type-meta mt-1 font-mono">{s.actor}</p>
        </div>
        <span className={`font-display shrink-0 text-lg font-semibold tabular-nums ${rateTone(s.successRate)}`}>
          {pct(s.successRate)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Runs" value={String(s.runs)} hint={s.running ? `${s.running} running` : undefined} />
        <Stat label="Spend" value={usd(s.spendUsd)} />
        <Stat label="Per run" value={usd(s.avgCostUsd, 4)} />
        <Stat label="Avg time" value={secs(s.avgDurationSec)} />
      </div>
      <div className="text-muted-foreground type-meta flex flex-wrap gap-x-3 gap-y-1">
        <span className="text-emerald-700">{s.succeeded} succeeded</span>
        <span className={s.failed ? "text-destructive" : undefined}>{s.failed} failed</span>
        <span className={s.timedOut ? "text-amber-700" : undefined}>{s.timedOut} timed out</span>
        <span>{s.aborted} aborted</span>
      </div>
      <div className="text-muted-foreground type-meta flex flex-wrap gap-x-3 gap-y-1">
        <span>Last run {when(s.lastRunAt)}</span>
        {problems > 0 ? (
          <span className="text-destructive">
            Last problem {when(s.lastFailureAt)} · {s.lastFailureStatus}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ApifyUsagePanel({ initial }: { initial: ActionResult<{ usage: ApifyUsage }> }) {
  const [usage, setUsage] = useState<ApifyUsage | null>(initial.ok ? initial.usage : null);
  const [error, setError] = useState<string | null>(initial.ok ? null : initial.error);
  const [days, setDays] = useState<ApifyWindow>(30);
  const [loading, setLoading] = useState(false);

  async function load(next: ApifyWindow) {
    setDays(next);
    setLoading(true);
    const r = await getApifyUsage(next);
    if (r.ok) {
      setUsage(r.usage);
      setError(null);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }

  const m = usage?.month;
  const scraperSpend = usage?.scrapers.reduce((a, s) => a + s.spendUsd, 0) ?? 0;

  return (
    <SectionCard
      icon={<Bug className="h-4 w-4" />}
      title="Apify"
      subtitle="Every scraper Mesita runs on Apify, read from Apify's own run list: what it cost and how often it worked. It counts the Supabase and the Render callers alike. Google images come from Google Places, not Apify, so they have no row here."
      state={
        <Button
          tone="secondary"
          size="sm"
          pending={loading}
          icon={<RefreshCw className="h-3 w-3" />}
          onClick={() => void load(days)}
        >
          Refresh
        </Button>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        {error ? <ErrorNote message={error} /> : null}

        {m ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat
              label="This billing cycle"
              value={usd(m.spendUsd)}
              hint={m.cycleStart ? `since ${m.cycleStart.slice(0, 10)}` : undefined}
            />
            <Stat
              label="Monthly limit"
              value={usd(m.limitUsd)}
              hint={m.limitUsd && m.spendUsd !== null
                ? `${Math.round((m.spendUsd / m.limitUsd) * 100)}% used`
                : undefined}
            />
            <Stat
              label="Cycle ends"
              value={m.cycleEnd ? m.cycleEnd.slice(0, 10) : "—"}
            />
          </div>
        ) : null}

        {m ? <DailyBars daily={m.daily} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Runs started in the last</span>
          {APIFY_WINDOWS.map((w) => (
            <ChoicePill key={w} active={days === w} disabled={loading} onClick={() => void load(w)}>
              {w === 1 ? "24 hours" : `${w} days`}
            </ChoicePill>
          ))}
        </div>

        {usage ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {usage.scrapers.map((s) => <ScraperCard key={s.key} s={s} />)}
            </div>
            <p className="text-muted-foreground type-meta">
              {usd(scraperSpend)} across these scrapers in the window
              {usage.other.runs > 0
                ? ` · ${usage.other.runs} runs of other actors, ${usd(usage.other.spendUsd)}`
                : ""}
              {usage.truncated ? " · more than 10,000 runs, oldest not counted" : ""}
              {` · read ${new Date(usage.checkedAt).toLocaleString()}`}
            </p>
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}
