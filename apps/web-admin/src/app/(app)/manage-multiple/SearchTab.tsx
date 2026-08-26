"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ListPlus, Loader2, Search } from "lucide-react";

import { CldrRegionInput } from "@/components/CldrRegionInput";
import { PlacesMap } from "@/components/PlacesMap";
import type { SearchErrorResponse, SearchResponse } from "@/lib/places-types";

import { estimateSearchCost } from "./search-cost";
import {
  MAX_QUERIES,
  MAX_RESULTS,
  RESULTS_OPTIONS,
} from "./search-tab-constants";
import { splitSearchBarInput } from "./google-place-ids";
import { QueryRow } from "./SearchQueryRows";
import { ResultSummary } from "./SearchResultSummary";

const SEARCH_CSV_HEADER =
  "query,place_id,name,address,rating,reviews,in_mesita,created_at,updated_at";

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildSearchCsvRows(result: SearchResponse): string[] {
  const rows: string[] = [SEARCH_CSV_HEADER];
  for (const q of result.queries) {
    for (const p of q.places) {
      rows.push(
        [
          q.query,
          p.id,
          p.displayName,
          p.formattedAddress,
          p.rating === null ? "" : String(p.rating),
          p.userRatingCount === null ? "" : String(p.userRatingCount),
          p.existsInMesita ? "yes" : "no",
          p.createdAt ?? "",
          p.updatedAt ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return rows;
}

export function SearchTab({
  onSendIds,
}: {
  onSendIds?: (placeIds: string[]) => void;
}) {
  const [bar, setBar] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [maxResults, setMaxResults] = useState(MAX_RESULTS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const parsed = useMemo(() => splitSearchBarInput(bar), [bar]);
  const queries = useMemo(
    () => (parsed.query ? [parsed.query] : []),
    [parsed],
  );
  const placeIds = parsed.placeIds;
  const unitCount = queries.length + placeIds.length;

  const overLimit = unitCount > MAX_QUERIES;
  const { totalCalls: estimatedApiCalls } = estimateSearchCost(
    queries.length,
    maxResults,
    placeIds.length,
  );
  const failedQueries = result?.queries.filter((q) => q.error !== null) ?? [];

  async function runSearch() {
    if (unitCount === 0 || overLimit) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/bulk-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries,
          placeIds,
          regionCode: regionCode.trim().toUpperCase(),
          maxResultsPerQuery: maxResults,
        }),
      });
      const data: SearchResponse | SearchErrorResponse = await res.json();
      if (!data.ok) {
        setError(data.error || `Search failed (HTTP ${res.status})`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const allPlaceIds = (result?.uniquePlaces ?? []).map((p) => p.id);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // ignore
    }
  }

  function downloadCsv() {
    if (!result) return;
    const rows = buildSearchCsvRows(result);
    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `google-search-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <div className="border-border/60 bg-muted/60 focus-within:border-ring/60 focus-within:ring-ring/10 rounded-xl border transition focus-within:ring-4">
          <div className="flex items-center gap-2 px-3">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            <input
              type="search"
              value={bar}
              onChange={(e) => setBar(e.target.value)}
              placeholder="Free text or Google Place IDs"
              aria-label="Google search"
              spellCheck={false}
              className="placeholder:text-muted-foreground/50 h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="submit"
              disabled={running || unitCount === 0 || overLimit}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {running ? "Searching…" : "Search"}
            </button>
          </div>
          <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-xs">
            <span>
              {parsed.query ? "1 query" : "0 queries"}
              {parsed.placeIds.length > 0
                ? ` · ${parsed.placeIds.length} Place ID${parsed.placeIds.length === 1 ? "" : "s"}`
                : ""}
              {overLimit ? ` · over the ${MAX_QUERIES} max` : ""}
              {unitCount > 0 ? ` · ~${estimatedApiCalls} Google API calls` : ""}
              {" · "}
              <Link
                href="/filters-config#s-map"
                className="text-foreground underline-offset-2 hover:underline"
              >
                Discovery › Map
              </Link>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Results per query"
                className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5"
              >
                {RESULTS_OPTIONS.map((o) => {
                  const selected = o.value === maxResults;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      disabled={running}
                      aria-pressed={selected}
                      onClick={() => setMaxResults(o.value)}
                      className={
                        "inline-flex h-7 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums disabled:opacity-50 " +
                        (selected
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <CldrRegionInput
                compact
                value={regionCode}
                onChange={setRegionCode}
                disabled={running}
              />
            </div>
          </div>
        </div>
      </form>

      {error && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-8 flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Search failed</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-10 space-y-6">
          <ResultSummary
            result={result}
            copied={copied}
            onCopy={copyText}
            onDownload={downloadCsv}
          />

          {onSendIds && allPlaceIds.length > 0 && (
            <button
              type="button"
              onClick={() => onSendIds(allPlaceIds)}
              className="border-border bg-card hover:border-foreground inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium"
            >
              <ListPlus className="h-4 w-4" />
              Send {allPlaceIds.length}{" "}
              {allPlaceIds.length === 1 ? "ID" : "IDs"} to Mesita Search / Intake
            </button>
          )}

          {failedQueries.length > 0 && (
            <section className="border-destructive/40 bg-destructive/5 text-destructive rounded-2xl border p-4 text-sm">
              <p className="font-medium">
                {failedQueries.length}{" "}
                {failedQueries.length === 1 ? "query" : "queries"} failed
              </p>
              <ul className="mt-2 space-y-1 opacity-90">
                {failedQueries.map((q) => (
                  <li key={q.query} className="text-xs">
                    <span className="font-mono font-medium">“{q.query}”</span>{" "}
                    — {q.error}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.mesitaLookupError && (
            <section className="border-amber-500/40 bg-amber-500/5 flex items-start gap-3 rounded-2xl border p-4 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  Couldn&apos;t check which places are already in Mesita
                </p>
                <p className="mt-1 opacity-90">{result.mesitaLookupError}</p>
              </div>
            </section>
          )}

          <PlacesMap places={result.uniquePlaces} />

          <section>
            <h2 className="text-foreground type-eyebrow">By query</h2>
            <ul className="border-border bg-card divide-border mt-3 divide-y rounded-2xl border">
              {result.queries.map((q) => (
                <QueryRow
                  key={q.query}
                  q={q}
                  copied={copied}
                  onCopy={copyText}
                />
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
