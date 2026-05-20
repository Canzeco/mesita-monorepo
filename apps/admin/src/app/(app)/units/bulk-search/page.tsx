"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Loader2, AlertTriangle, Play } from "lucide-react";

type PlaceLite = {
  id: string;
  displayName: string;
  formattedAddress: string;
};

type QueryResult = {
  query: string;
  places: PlaceLite[];
  truncated: boolean;
  error: string | null;
};

type SearchResponse = {
  ok: true;
  queries: QueryResult[];
  uniquePlaces: PlaceLite[];
  uniqueCount: number;
  regionCode: string;
  maxResultsPerQuery: number;
};

type ErrorResponse = { ok: false; error: string };

const MAX_QUERIES = 50;

export default function BulkSearchUnitsPage() {
  const [queriesText, setQueriesText] = useState("");
  const [regionCode, setRegionCode] = useState("MX");
  const [maxResults, setMaxResults] = useState(60);
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
  const failedQueries = result?.queries.filter((q) => q.error !== null) ?? [];

  async function runSearch() {
    if (queries.length === 0 || overLimit) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/units/bulk-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries,
          regionCode: regionCode.trim().toUpperCase() || "MX",
          maxResultsPerQuery: maxResults,
        }),
      });
      const data: SearchResponse | ErrorResponse = await res.json();
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

  return (
    <div className="mx-auto max-w-4xl px-8 pt-12 pb-20">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Units · Bulk
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Bulk search units
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Paste one Google Places query per line. Each runs through the
        Places Text Search API and the deduped union of Place IDs comes
        back below.
      </p>

      <div className="border-border bg-card mt-8 rounded-2xl border p-5">
        <label
          htmlFor="queries"
          className="text-foreground block text-sm font-medium"
        >
          Queries{" "}
          <span className="text-muted-foreground font-normal">
            (one per line, max {MAX_QUERIES})
          </span>
        </label>
        <textarea
          id="queries"
          value={queriesText}
          onChange={(e) => setQueriesText(e.target.value)}
          rows={8}
          placeholder={
            "burger restaurants in Mexico City\nmezcalerias in Oaxaca\nspecialty coffee in Monterrey"
          }
          className="border-border bg-background placeholder:text-muted-foreground/60 mt-2 w-full rounded-xl border px-3 py-2.5 font-mono text-sm leading-relaxed outline-none focus:border-primary"
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span
            className={
              overLimit ? "text-destructive" : "text-muted-foreground"
            }
          >
            {queries.length} {queries.length === 1 ? "query" : "queries"}
            {overLimit ? ` — over ${MAX_QUERIES} cap` : ""}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="region"
              className="text-foreground block text-sm font-medium"
            >
              Region code
            </label>
            <input
              id="region"
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              maxLength={2}
              placeholder="MX"
              className="border-border bg-background mt-2 w-full rounded-xl border px-3 py-2 font-mono text-sm uppercase outline-none focus:border-primary"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              ISO-3166-1 alpha-2 (e.g. MX, US, AR). Biases ranking but
              does not strictly filter.
            </p>
          </div>
          <div>
            <label
              htmlFor="max"
              className="text-foreground block text-sm font-medium"
            >
              Max results per query
            </label>
            <select
              id="max"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="border-border bg-background mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value={20}>20 (1 page)</option>
              <option value={40}>40 (2 pages)</option>
              <option value={60}>60 (3 pages — API max)</option>
            </select>
            <p className="text-muted-foreground mt-1 text-xs">
              Google caps Text Search at 60 results per query regardless.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={runSearch}
            disabled={running || queries.length === 0 || overLimit}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? "Searching…" : "Run search"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Search failed</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {result.uniqueCount} unique{" "}
                {result.uniqueCount === 1 ? "Place ID" : "Place IDs"}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                from {result.queries.length}{" "}
                {result.queries.length === 1 ? "query" : "queries"} ·{" "}
                {totalRaw(result.queries) - result.uniqueCount} duplicates
                filtered · region {result.regionCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                copyText(
                  result.uniquePlaces.map((p) => p.id).join("\n"),
                  "all",
                )
              }
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
            >
              {copied === "all" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied === "all" ? "Copied" : "Copy all Place IDs"}
            </button>
          </div>

          {failedQueries.length > 0 && (
            <div className="border-destructive/40 bg-destructive/5 text-destructive mt-4 rounded-2xl border p-4 text-sm">
              <p className="font-medium">
                {failedQueries.length}{" "}
                {failedQueries.length === 1 ? "query" : "queries"} failed
              </p>
              <ul className="mt-2 space-y-1 opacity-90">
                {failedQueries.map((q) => (
                  <li key={q.query} className="font-mono text-xs">
                    <span className="font-sans font-medium">{q.query}</span>{" "}
                    — {q.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {result.queries.map((q) => (
              <details
                key={q.query}
                className="border-border bg-card group rounded-2xl border p-4 text-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="flex-1 truncate font-medium">
                    {q.query}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {q.error
                      ? "error"
                      : `${q.places.length}${q.truncated ? "+ (capped)" : ""}`}
                  </span>
                </summary>
                {q.error ? (
                  <p className="text-destructive mt-3 text-xs">{q.error}</p>
                ) : (
                  <div className="mt-3">
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            q.places.map((p) => p.id).join("\n"),
                            q.query,
                          )
                        }
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
                      >
                        {copied === q.query ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copied === q.query
                          ? "Copied"
                          : `Copy ${q.places.length} ID${q.places.length === 1 ? "" : "s"}`}
                      </button>
                    </div>
                    <ul className="border-border divide-border divide-y rounded-xl border">
                      {q.places.length === 0 ? (
                        <li className="text-muted-foreground px-3 py-2 text-xs">
                          No results.
                        </li>
                      ) : (
                        q.places.map((p) => (
                          <li
                            key={p.id}
                            className="grid grid-cols-1 gap-1 px-3 py-2 text-xs sm:grid-cols-[1fr_auto]"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {p.displayName || "(no name)"}
                              </p>
                              <p className="text-muted-foreground truncate">
                                {p.formattedAddress}
                              </p>
                            </div>
                            <code className="text-muted-foreground font-mono">
                              {p.id}
                            </code>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function totalRaw(queries: QueryResult[]): number {
  let n = 0;
  for (const q of queries) n += q.places.length;
  return n;
}
