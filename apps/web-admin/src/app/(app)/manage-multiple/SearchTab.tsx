"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { PlacesMap } from "@/components/PlacesMap";
import type { SearchErrorResponse, SearchResponse } from "@/lib/places-types";

import { estimateSearchCost } from "./search-cost";
import { MAX_QUERIES, MAX_RESULTS } from "./search-tab-constants";
import { QueryRow } from "./SearchQueryRows";
import { SearchParametersSection } from "./SearchParametersSection";
import { SearchQueriesSection } from "./SearchQueriesSection";
import { ResultSummary } from "./SearchResultSummary";

const SEARCH_CSV_HEADER =
  "query,place_id,name,address,rating,reviews,in_mesita,created_at,updated_at";

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Flatten a bulk-search response into CSV rows (header first). */
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

export function SearchTab() {
  const [queriesText, setQueriesText] = useState("");
  const [regionCode, setRegionCode] = useState("MX");
  const [maxResults, setMaxResults] = useState(MAX_RESULTS);
  const [minRating, setMinRating] = useState(0);
  const [minReviews, setMinReviews] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const queries = useMemo(
    () =>
      Array.from(
        new Set(
          queriesText
            .split("\n")
            .map((q) => q.trim())
            .filter((q) => q.length > 0),
        ),
      ),
    [queriesText],
  );

  const overLimit = queries.length > MAX_QUERIES;
  const { pagesPerQuery, totalCalls: estimatedApiCalls, totalCostUsd: estimatedCostUsd } =
    estimateSearchCost(queries.length, maxResults);
  const failedQueries = result?.queries.filter((q) => q.error !== null) ?? [];

  async function runSearch() {
    if (queries.length === 0 || overLimit) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/bulk-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries,
          regionCode: regionCode.trim().toUpperCase() || "MX",
          maxResultsPerQuery: maxResults,
          minRating,
          minUserRatingCount: minReviews,
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
    a.download = `bulk-search-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        Paste one Google Places query per line — each runs through the Places
        Text Search API, and the deduped union of Place IDs comes back below,
        ready for bulk create. Use the quality filters to drop low-signal
        listings before they hit the results.
      </p>

      <section className="mt-8 space-y-8">
        <SearchQueriesSection
          queriesText={queriesText}
          queriesCount={queries.length}
          estimatedApiCalls={estimatedApiCalls}
          overLimit={overLimit}
          onQueriesTextChange={setQueriesText}
        />

        <SearchParametersSection
          maxResults={maxResults}
          regionCode={regionCode}
          minRating={minRating}
          minReviews={minReviews}
          running={running}
          queriesCount={queries.length}
          overLimit={overLimit}
          pagesPerQuery={pagesPerQuery}
          estimatedApiCalls={estimatedApiCalls}
          estimatedCostUsd={estimatedCostUsd}
          onMaxResultsChange={setMaxResults}
          onRegionCodeChange={setRegionCode}
          onMinRatingChange={setMinRating}
          onMinReviewsChange={setMinReviews}
          onRunSearch={runSearch}
        />
      </section>

      {/* Error */}
      {error && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-8 flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Search failed</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-10 space-y-6">
          <ResultSummary
            result={result}
            copied={copied}
            onCopy={copyText}
            onDownload={downloadCsv}
          />

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
            <h2 className="text-foreground text-xs font-medium tracking-[0.14em] uppercase">
              By query
            </h2>
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
