"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { ActivityCounterGrid } from "@/components/activity/ActivityCounterGrid";
import { ActivityFeedList } from "@/components/activity/ActivityFeedList";
import { Button } from "@/components/admin-ui/config";
import { formatAbsoluteUtc } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import type { ActivitySummary } from "@/lib/activity-summary-types";
import { getActivitySummary } from "@/lib/activity-summary";
import { listLogs, type ListLogsResult } from "./actions";
import { filterLines, type LogLine } from "./filter";

const POLL_MS = 60_000;

function levelClass(level: string | null): string {
  const name = (level ?? "").toLowerCase();
  if (name === "error" || name === "fatal") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (name === "warn" || name === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

function RenderLine({ line }: { line: LogLine }) {
  return (
    <li className="border-border/60 grid gap-2 border-b px-4 py-2.5 last:border-b-0 sm:grid-cols-[9.5rem_4.5rem_1fr] sm:items-start sm:gap-3">
      <time className="text-muted-foreground font-mono type-meta" dateTime={line.timestamp}>
        {formatAbsoluteUtc(line.timestamp)}
      </time>
      <span
        className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 type-meta font-semibold ${levelClass(line.level)}`}
      >
        {line.level ?? "line"}
      </span>
      <div className="min-w-0">
        {line.task ? (
          <p className="text-muted-foreground mb-0.5 type-meta">{line.task}</p>
        ) : null}
        <p className="font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          {line.message || "—"}
        </p>
      </div>
    </li>
  );
}

export function LogsClient({
  initialLogs,
  initialSummary,
}: {
  initialLogs: ListLogsResult;
  initialSummary: ActionResult<ActivitySummary>;
}) {
  const [summary, setSummary] = useState<ActivitySummary | null>(
    initialSummary.ok ? initialSummary : null,
  );
  const [summaryError, setSummaryError] = useState<string | null>(
    initialSummary.ok ? null : initialSummary.error,
  );
  const [lines, setLines] = useState<LogLine[]>(initialLogs.ok ? initialLogs.lines : []);
  const [query, setQuery] = useState("");
  const [logsError, setLogsError] = useState<string | null>(
    initialLogs.ok ? null : initialLogs.error,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(initialLogs.ok ? initialLogs.hasMore : false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const [logsResult, summaryResult] = await Promise.all([
        listLogs(),
        getActivitySummary(),
      ]);
      if (!logsResult.ok) setLogsError(logsResult.error);
      else {
        setLogsError(null);
        setLines(logsResult.lines);
        setHasMore(logsResult.hasMore);
      }
      if (!summaryResult.ok) setSummaryError(summaryResult.error);
      else {
        setSummaryError(null);
        setSummary(summaryResult);
      }
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const shown = useMemo(() => filterLines(lines, query), [lines, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          tone="secondary"
          pending={refreshing}
          onClick={() => void refresh()}
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {summaryError ? <ErrorNote message={summaryError} /> : null}
      {summary ? (
        <section className="border-border bg-card overflow-hidden rounded-2xl border p-4">
          <ActivityCounterGrid
            windowDays={summary.windowDays}
            guestOpens={summary.guestOpens}
            guestSocial={summary.guestSocial}
            operatorVerbs={summary.operatorVerbs}
          />
        </section>
      ) : null}

      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="border-border/60 text-muted-foreground flex items-center justify-between border-b px-4 py-3 type-meta">
          <span className="font-semibold text-foreground">Recent activity</span>
          <span>{summary?.recentFeed.length ?? 0} items</span>
        </div>
        <ActivityFeedList items={summary?.recentFeed ?? []} />
      </section>

      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setWorkflowOpen((open) => !open)}
          aria-expanded={workflowOpen}
        >
          <span className="text-sm font-semibold">Enrichment workflow</span>
          <ChevronDown
            className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${workflowOpen ? "rotate-180" : ""}`}
          />
        </button>
        {workflowOpen ? (
          <div className="border-border/60 border-t px-4 pb-4">
            <div className="mb-4 mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter lines"
                aria-label="Filter lines"
                className="border-border bg-card h-10 min-w-0 flex-1 rounded-full border px-4 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
              />
            </div>
            {logsError ? <ErrorNote message={logsError} /> : null}
            <div className="text-muted-foreground mb-2 flex items-center justify-between type-meta">
              <span>
                {shown.length} {shown.length === 1 ? "line" : "lines"}
              </span>
              {hasMore ? <span>Newest 100. Older lines were left off.</span> : null}
            </div>
            {shown.length === 0 ? (
              logsError ? null : (
                <p className="text-muted-foreground py-6 text-sm">
                  {lines.length === 0
                    ? "No lines in the last day."
                    : "No lines match that filter."}
                </p>
              )
            ) : (
              <ol className="max-h-[50vh] overflow-y-auto rounded-xl border">
                {shown.map((line) => <RenderLine key={line.id} line={line} />)}
              </ol>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
