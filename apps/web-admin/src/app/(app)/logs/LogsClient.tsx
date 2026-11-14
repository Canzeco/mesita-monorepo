"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Button,
  Chip,
  type ChipTone,
  Collapsible,
  EmptyState,
  Notice,
  SearchField,
  SectionCard,
} from "@/components/admin-ui";
import { ActivityFeedList } from "@/components/activity/ActivityFeedList";
import { formatAbsoluteUtc } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import type { ActivitySummary } from "@/lib/activity-summary-types";
import { getActivitySummary } from "@/lib/activity-summary";
import { listLogs, type ListLogsResult } from "./actions";
import { filterLines, type LogLine } from "./filter";

const POLL_MS = 60_000;

function levelTone(level: string | null): ChipTone {
  const name = (level ?? "").toLowerCase();
  if (name === "error" || name === "fatal") return "danger";
  if (name === "warn" || name === "warning") return "warning";
  return "neutral";
}

function RenderLine({ line }: { line: LogLine }) {
  return (
    <li className="border-border/60 grid gap-2 border-b px-4 py-2.5 last:border-b-0 sm:grid-cols-[9.5rem_4.5rem_1fr] sm:items-start sm:gap-3">
      <time className="text-muted-foreground font-mono type-meta" dateTime={line.timestamp}>
        {formatAbsoluteUtc(line.timestamp)}
      </time>
      <Chip tone={levelTone(line.level)} className="w-fit">
        {line.level ?? "line"}
      </Chip>
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

      {summaryError ? <Notice>{summaryError}</Notice> : null}
      <SectionCard
        title="Recent activity"
        right={<span className="text-muted-foreground type-meta">{summary?.recentFeed.length ?? 0} items</span>}
      >
        <div className="border-border mt-4 overflow-hidden rounded-xl border">
          <ActivityFeedList items={summary?.recentFeed ?? []} />
        </div>
      </SectionCard>

      <Collapsible summary="Enrichment workflow">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Filter lines"
            aria-label="Filter lines"
            className="min-w-0 flex-1"
          />
        </div>
        {logsError ? <Notice className="mb-4">{logsError}</Notice> : null}
        <div className="text-muted-foreground mb-2 flex items-center justify-between type-meta">
          <span>
            {shown.length} {shown.length === 1 ? "line" : "lines"}
          </span>
          {hasMore ? <span>Newest 100. Older lines were left off.</span> : null}
        </div>
        {shown.length === 0 ? (
          logsError ? null : (
            <EmptyState>
              {lines.length === 0
                ? "No lines in the last day."
                : "No lines match that filter."}
            </EmptyState>
          )
        ) : (
          <ol className="border-border bg-card max-h-[50vh] overflow-y-auto rounded-xl border">
            {shown.map((line) => <RenderLine key={line.id} line={line} />)}
          </ol>
        )}
      </Collapsible>
    </div>
  );
}
