"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Play,
  Upload,
  XCircle,
} from "lucide-react";
import {
  computeEnrichmentCost,
  fmtTime,
  money,
  type LinkCounts,
} from "../enricher-config/cost-model";
import type { SynthesisQuality } from "../enricher-config/actions";
import { enrichPlace, type ReenrichMode } from "../manage-single/actions";

const PROJECT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;
const CONCURRENCY = 4;

// Lighter modes skip gather (and contents skips analysis). Factors are
// approximate — the banner is a spend bound, not a bill.
const MODE_COST_FACTOR: Record<ReenrichMode, number> = {
  full: 1,
  analysis: 0.35,
  contents: 0.08,
};

type RowStatus =
  | { status: "pending" }
  | { status: "running" }
  | { status: "ok" }
  | { status: "error"; error: string };

export type EnrichCostSeed = {
  quality: SynthesisQuality;
  imageModel: SynthesisQuality;
  gCollect: number;
  igCollect: number;
  gAnalyze: number;
  igAnalyze: number;
  links: LinkCounts;
};

const MODES: { mode: ReenrichMode; label: string; detail: string }[] = [
  {
    mode: "full",
    label: "Full",
    detail: "Research + analysis + contents (re-gathers).",
  },
  {
    mode: "analysis",
    label: "Analysis + contents",
    detail: "Reuses gathered data — no re-gather.",
  },
  {
    mode: "contents",
    label: "Contents only",
    detail: "Re-synthesises copy from last analysis. Cheapest.",
  },
];

export function EnrichTab({ costSeed }: { costSeed: EnrichCostSeed | null }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ReenrichMode>("full");
  const [results, setResults] = useState<Record<string, RowStatus>>({});
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const projectIds = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tok of text.split(/[\s,]+/)) {
      const t = tok.trim().toLowerCase();
      if (PROJECT_ID_RE.test(t) && !seen.has(t)) {
        seen.add(t);
        out.push(t);
        if (out.length >= MAX_IDS) break;
      }
    }
    return out;
  }, [text]);

  const estimate = useMemo(() => {
    if (!costSeed || projectIds.length === 0) return null;
    const base = computeEnrichmentCost({
      ...costSeed,
      places: projectIds.length,
    });
    const factor = MODE_COST_FACTOR[mode];
    return {
      total: base.total * factor,
      perPlace: base.perPlace * factor,
      totalSecs: base.totalSecs * factor,
    };
  }, [costSeed, projectIds.length, mode]);

  const done = projectIds.filter((id) => {
    const s = results[id]?.status;
    return s === "ok" || s === "error";
  }).length;
  const okCount = projectIds.filter((id) => results[id]?.status === "ok").length;
  const failed = projectIds.filter((id) => results[id]?.status === "error").length;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText((prev) => (prev ? `${prev}\n${content}` : content));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function runAll() {
    if (running || projectIds.length === 0) return;
    setRunning(true);
    setResults(
      Object.fromEntries(projectIds.map((id) => [id, { status: "pending" as const }])),
    );
    const ids = [...projectIds];
    let cursor = 0;
    const worker = async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        setResults((prev) => ({ ...prev, [id]: { status: "running" } }));
        try {
          const r = await enrichPlace(id, mode);
          setResults((prev) => ({
            ...prev,
            [id]: r.ok
              ? { status: "ok" }
              : { status: "error", error: r.error },
          }));
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            [id]: {
              status: "error",
              error: err instanceof Error ? err.message : "Unexpected error",
            },
          }));
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
    );
    setRunning(false);
  }

  function copyFailed() {
    const ids = projectIds.filter((id) => results[id]?.status === "error");
    void navigator.clipboard.writeText(ids.join("\n"));
  }

  return (
    <div>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        Paste project IDs (one per line) or upload a list. Each row queues the
        same re-enrich pipeline as the single-place control — the Enricher cron
        runs async after trigger. Caps and models live in{" "}
        <a
          href="/enricher-config/config"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Enricher Config
        </a>
        .
      </p>

      <div className="border-border bg-card mt-8 rounded-2xl border p-6">
        <fieldset disabled={running}>
          <legend className="text-sm font-medium">Mode</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => {
              const selected = mode === m.mode;
              return (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => setMode(m.mode)}
                  className={
                    selected
                      ? "border-foreground bg-foreground/5 rounded-xl border px-3 py-3 text-left"
                      : "border-border hover:border-foreground/40 rounded-xl border px-3 py-3 text-left transition"
                  }
                >
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className="text-muted-foreground mt-1 block text-[11px] leading-snug">
                    {m.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="mt-6 block text-sm font-medium" htmlFor="project-ids">
          Project IDs
        </label>
        <textarea
          id="project-ids"
          value={text}
          disabled={running}
          rows={8}
          placeholder={
            "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\nxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          }
          onChange={(e) => setText(e.target.value)}
          className="border-border bg-background focus:border-foreground mt-2 w-full rounded-xl border px-3 py-2 font-mono text-xs leading-relaxed outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={running}
            className="border-border hover:border-foreground/40 inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload CSV / TXT
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={onFile}
            className="hidden"
          />
          <span className="text-muted-foreground text-xs">
            {projectIds.length} valid ID{projectIds.length === 1 ? "" : "s"}{" "}
            detected
            {projectIds.length >= MAX_IDS ? ` (capped at ${MAX_IDS})` : ""}
          </span>
        </div>

        {estimate ? (
          <div className="border-border bg-muted/40 mt-5 rounded-xl border px-4 py-3 text-sm">
            <p className="font-medium">
              Est. ~{money(estimate.total)} · ~{fmtTime(estimate.totalSecs)} for{" "}
              {projectIds.length} place{projectIds.length === 1 ? "" : "s"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              ~{money(estimate.perPlace)} / place at current Enricher Config
              rates
              {mode !== "full" ? " (scaled for lighter mode)" : ""}. Approximate
              — not a bill. Full calculator:{" "}
              <a
                href="/enricher-config/calculator"
                className="text-foreground font-medium underline underline-offset-2"
              >
                Enricher Calculator
              </a>
              .
            </p>
          </div>
        ) : costSeed === null ? (
          <p className="text-muted-foreground mt-5 text-xs">
            Cost estimate unavailable — Enricher settings failed to load. You
            can still queue re-enrich.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runAll}
            disabled={running || projectIds.length === 0}
            className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Queuing… {done}/{projectIds.length}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Re-enrich {projectIds.length} place
                {projectIds.length === 1 ? "" : "s"}
              </>
            )}
          </button>
          {done > 0 && (
            <span className="text-muted-foreground text-xs">
              {okCount} queued · {failed} failed
            </span>
          )}
          {failed > 0 && !running && (
            <button
              type="button"
              onClick={copyFailed}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              Copy failed IDs
            </button>
          )}
        </div>
      </div>

      {Object.keys(results).length > 0 && (
        <div className="border-border bg-card mt-6 overflow-hidden rounded-2xl border">
          <ul className="divide-border/60 divide-y">
            {projectIds.map((id) => {
              const r = results[id];
              if (!r) return null;
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <StatusIcon status={r.status} />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted-foreground font-mono text-xs">
                      {id}
                    </span>
                    {r.status === "ok" && (
                      <p className="text-muted-foreground text-[11px]">
                        Enricher queued
                      </p>
                    )}
                    {r.status === "error" && (
                      <p className="text-destructive text-[11px]">{r.error}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: RowStatus["status"] }) {
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "error")
    return <XCircle className="text-destructive h-4 w-4 shrink-0" />;
  if (status === "running")
    return <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />;
  return (
    <span className="border-border bg-background h-4 w-4 shrink-0 rounded-full border" />
  );
}
