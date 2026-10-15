"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Button } from "@/components/admin-ui/config";
import { formatAbsoluteUtc } from "@/lib/format";
import { listLogs, type ListLogsResult } from "./actions";
import { filterLines, type LogLine } from "./filter";

const POLL_MS = 8_000;

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

function Line({ line }: { line: LogLine }) {
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

export function LogsClient({ initial }: { initial: ListLogsResult }) {
  const [lines, setLines] = useState<LogLine[]>(initial.ok ? initial.lines : []);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(initial.ok ? null : initial.error);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(initial.ok ? initial.hasMore : false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const result = await listLogs();
    setRefreshing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setLines(result.lines);
    setHasMore(result.hasMore);
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
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter lines"
          aria-label="Filter lines"
          className="border-border bg-card h-10 min-w-0 flex-1 rounded-full border px-4 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
        />
        <Button
          tone="secondary"
          pending={refreshing}
          onClick={() => void refresh()}
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <section className="border-border bg-card mt-4 overflow-hidden rounded-2xl border">
        <div className="border-border/60 text-muted-foreground flex items-center justify-between border-b px-4 py-3 type-meta">
          <span>
            {shown.length} {shown.length === 1 ? "line" : "lines"}
          </span>
          {hasMore ? <span>Newest 100. Older lines were left off.</span> : null}
        </div>
        {shown.length === 0 ? (
          error ? null : (
            <p className="text-muted-foreground px-4 py-8 text-sm">
              {lines.length === 0
                ? "No lines in the last day."
                : "No lines match that filter."}
            </p>
          )
        ) : (
          <ol className="max-h-[70vh] overflow-y-auto">
            {shown.map((line) => <Line key={line.id} line={line} />)}
          </ol>
        )}
      </section>
    </div>
  );
}
