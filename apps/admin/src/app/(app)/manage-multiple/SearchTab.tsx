"use client";

import { useMemo, useState } from "react";
import {
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Play,
  Download,
  ChevronRight,
  CheckCircle2,
  Star,
  SlidersHorizontal,
} from "lucide-react";
import { PlacesMap } from "@/components/PlacesMap";
import type {
  PlaceLite,
  QueryResult,
  SearchResponse,
  SearchErrorResponse,
} from "@/lib/places-types";
import { formatShortDate } from "@/lib/format";
import { CostCalculator, estimateSearchCost } from "./search-cost";

const MAX_QUERIES = 200;
const MAX_RESULTS = 50;
const MIN_RESULTS = 1;

const EXAMPLE_QUERIES = [
  "Mejores restaurantes en San Pedro",
  "Mezcalerías en Oaxaca",
  "Coffee shops in Mexico City",
];

// Quality-filter presets. 0 = off ("Any"). Rating is a Google 1–5 score;
// reviews is a userRatingCount floor. A place must clear BOTH to survive.
const RATING_OPTIONS: { label: string; value: number }[] = [
  { label: "Any", value: 0 },
  { label: "3.5+", value: 3.5 },
  { label: "4.0+", value: 4 },
  { label: "4.5+", value: 4.5 },
];
const REVIEW_OPTIONS: { label: string; value: number }[] = [
  { label: "Any", value: 0 },
  { label: "10+", value: 10 },
  { label: "50+", value: 50 },
  { label: "100+", value: 100 },
  { label: "500+", value: 500 },
];

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
    const rows: string[] = [
      "query,place_id,name,address,rating,reviews,in_mesita,created_at,updated_at",
    ];
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
        {/* Step 1 — queries */}
        <div className="space-y-3">
          <StepHeading
            step={1}
            title="Queries"
            hint="One search per line. Duplicates and blank lines are ignored."
          />
          <div className="border-border bg-card shadow-elev rounded-3xl border p-1">
            <div className="border-border bg-background rounded-[20px] border">
              <textarea
                id="queries"
                value={queriesText}
                onChange={(e) => setQueriesText(e.target.value)}
                rows={7}
                placeholder={EXAMPLE_QUERIES.join("\n")}
                spellCheck={false}
                className="placeholder:text-muted-foreground/50 block w-full resize-y rounded-[20px] bg-transparent px-5 py-4 font-mono text-sm leading-relaxed outline-none"
              />
              <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className={
                      overLimit
                        ? "text-destructive font-medium"
                        : "text-foreground/70 font-medium"
                    }
                  >
                    {queries.length} {queries.length === 1 ? "query" : "queries"}
                    {overLimit && ` · over the ${MAX_QUERIES} max`}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>
                    ~{estimatedApiCalls} Google API call
                    {estimatedApiCalls === 1 ? "" : "s"}
                  </span>
                  {queries.length === 0 && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <button
                        type="button"
                        onClick={() =>
                          setQueriesText(EXAMPLE_QUERIES.join("\n"))
                        }
                        className="text-secondary hover:text-secondary/80 font-medium underline-offset-2 hover:underline"
                      >
                        Try examples
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 — search settings */}
        <div className="space-y-3">
          <StepHeading
            step={2}
            title="Search settings"
            hint="How many results to pull per query, and which country to bias toward."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ParamCard
              label="Results per query"
              footer={`${MIN_RESULTS}–${MAX_RESULTS} · more = higher cost`}
            >
              <input
                type="number"
                min={MIN_RESULTS}
                max={MAX_RESULTS}
                value={maxResults}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  setMaxResults(
                    Math.min(MAX_RESULTS, Math.max(MIN_RESULTS, Math.round(n))),
                  );
                }}
                aria-label="Max results per query"
                className="font-display w-full bg-transparent text-center text-5xl font-semibold tracking-tight tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </ParamCard>

            <ParamCard label="Region" footer="ISO-3166-1 alpha-2">
              <input
                value={regionCode}
                onChange={(e) =>
                  setRegionCode(
                    e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase(),
                  )
                }
                maxLength={2}
                placeholder="MX"
                aria-label="Region code"
                className="font-display block w-full bg-transparent text-center font-mono text-5xl font-semibold tracking-tight uppercase outline-none"
              />
            </ParamCard>
          </div>
        </div>

        {/* Step 3 — quality filters */}
        <div className="space-y-3">
          <StepHeading
            step={3}
            title="Quality filters"
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            hint="Places with many Google reviews and a high rating are almost always real, good venues. Filter out the noise — the results tell you how many each query dropped, so you never mistake a filter for an empty search."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FilterCard
              label="Minimum rating"
              footer="Google star score"
              active={minRating > 0}
            >
              <ChipRow
                options={RATING_OPTIONS}
                value={minRating}
                onChange={setMinRating}
              />
            </FilterCard>
            <FilterCard
              label="Minimum reviews"
              footer="Google review count"
              active={minReviews > 0}
            >
              <ChipRow
                options={REVIEW_OPTIONS}
                value={minReviews}
                onChange={setMinReviews}
              />
            </FilterCard>
          </div>
        </div>

        <CostCalculator
          queries={queries.length}
          pagesPerQuery={pagesPerQuery}
          totalCalls={estimatedApiCalls}
          totalCostUsd={estimatedCostUsd}
        />

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={runSearch}
            disabled={running || queries.length === 0 || overLimit}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            {running ? "Searching…" : "Run search"}
          </button>
        </div>
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

function StepHeading({
  step,
  title,
  hint,
  icon,
}: {
  step: number;
  title: string;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-primary/10 text-primary font-display mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {hint}
        </p>
      </div>
    </div>
  );
}

function ParamCard({
  label,
  footer,
  tone = "default",
  children,
}: {
  label: string;
  footer: string;
  tone?: "default" | "warn";
  children: React.ReactNode;
}) {
  const toneClasses =
    tone === "warn"
      ? "border-destructive/40 text-destructive"
      : "border-border text-foreground";
  return (
    <label
      className={`bg-card shadow-elev flex flex-col gap-1 rounded-2xl border px-5 py-4 transition focus-within:border-primary ${toneClasses}`}
    >
      <span className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
        {label}
      </span>
      <div className="flex items-center justify-center py-1">{children}</div>
      <span className="text-muted-foreground text-center text-[11px]">
        {footer}
      </span>
    </label>
  );
}

function FilterCard({
  label,
  footer,
  active,
  children,
}: {
  label: string;
  footer: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "bg-card shadow-elev flex flex-col gap-3 rounded-2xl border px-5 py-4 transition " +
        (active ? "border-primary/50" : "border-border")
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
          {label}
        </span>
        <span className="text-muted-foreground/70 text-[11px]">{footer}</span>
      </div>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={selected}
            className={
              "rounded-xl px-3 py-1.5 text-sm font-medium tabular-nums transition " +
              (selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ResultSummary({
  result,
  copied,
  onCopy,
  onDownload,
}: {
  result: SearchResponse;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  onDownload: () => void;
}) {
  const totalRawCount = result.queries.reduce((n, q) => n + q.rawCount, 0);
  const duplicatesCount =
    result.queries.reduce((n, q) => n + q.places.length, 0) -
    result.uniqueCount;
  const filtersActive =
    result.minRating > 0 || result.minUserRatingCount > 0;
  return (
    <section className="border-border bg-pink-gradient shadow-elev relative overflow-hidden rounded-3xl border p-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-secondary text-xs font-medium tracking-[0.14em] uppercase">
            Result
          </p>
          <p className="font-display mt-1 text-5xl font-semibold tracking-tight md:text-6xl">
            {result.uniqueCount.toLocaleString()}
          </p>
          <p className="text-foreground/70 mt-1 text-sm">
            unique {result.uniqueCount === 1 ? "Place ID" : "Place IDs"} · from{" "}
            {result.queries.length}{" "}
            {result.queries.length === 1 ? "query" : "queries"}
            {duplicatesCount > 0 && <> · {duplicatesCount} duplicates filtered</>}{" "}
            · region {result.regionCode}
            {result.mesitaLookupError === null && (
              <>
                {" · "}
                <span className="text-foreground font-medium">
                  {result.mesitaMatchCount}
                </span>{" "}
                already in Mesita
              </>
            )}
          </p>
          {filtersActive && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-foreground/60 inline-flex items-center gap-1 font-medium uppercase tracking-wide">
                <SlidersHorizontal className="h-3 w-3" />
                Filters
              </span>
              {result.minRating > 0 && (
                <span className="bg-background/70 text-foreground/80 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium">
                  <Star className="h-3 w-3 fill-current" />
                  {result.minRating.toFixed(1)}+
                </span>
              )}
              {result.minUserRatingCount > 0 && (
                <span className="bg-background/70 text-foreground/80 rounded-full px-2.5 py-0.5 font-medium">
                  {result.minUserRatingCount.toLocaleString()}+ reviews
                </span>
              )}
              <span className="text-foreground/60">
                · {result.filteredOutCount.toLocaleString()} of{" "}
                {totalRawCount.toLocaleString()} dropped below the bar
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onCopy(result.uniquePlaces.map((p) => p.id).join("\n"), "all")
            }
            className="bg-background hover:bg-background/80 inline-flex items-center gap-2 rounded-xl border border-transparent px-3.5 py-2 text-sm font-medium shadow-sm transition"
          >
            {copied === "all" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied === "all" ? "Copied" : "Copy all IDs"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="bg-background hover:bg-background/80 inline-flex items-center gap-2 rounded-xl border border-transparent px-3.5 py-2 text-sm font-medium shadow-sm transition"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>
      </div>
    </section>
  );
}

function RatingBadge({ place }: { place: PlaceLite }) {
  if (place.rating === null && place.userRatingCount === null) {
    return (
      <span className="text-muted-foreground/70 inline-flex items-center gap-1 text-[11px]">
        no Google rating yet
      </span>
    );
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="text-foreground/80 font-medium tabular-nums">
        {place.rating === null ? "—" : place.rating.toFixed(1)}
      </span>
      {place.userRatingCount !== null && (
        <span className="tabular-nums">
          · {place.userRatingCount.toLocaleString()}{" "}
          {place.userRatingCount === 1 ? "review" : "reviews"}
        </span>
      )}
    </span>
  );
}

function QueryRow({
  q,
  copied,
  onCopy,
}: {
  q: QueryResult;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasResults = q.places.length > 0;
  const mesitaHits = q.places.filter((p) => p.existsInMesita).length;
  const filteredOut = q.rawCount - q.places.length;
  const copyKey = `q:${q.query}`;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition"
        aria-expanded={open}
      >
        <ChevronRight
          className={
            "text-muted-foreground h-4 w-4 shrink-0 transition-transform " +
            (open ? "rotate-90" : "")
          }
        />
        <span className="flex-1 truncate text-sm font-medium">{q.query}</span>
        {mesitaHits > 0 && !q.error && (
          <span className="bg-secondary/15 text-secondary inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <CheckCircle2 className="h-3 w-3" />
            {mesitaHits} in Mesita
          </span>
        )}
        {filteredOut > 0 && !q.error && (
          <span className="text-muted-foreground bg-muted/60 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums">
            {filteredOut} filtered
          </span>
        )}
        {q.error ? (
          <span className="text-destructive bg-destructive/10 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
            error
          </span>
        ) : (
          <span className="text-foreground/70 bg-muted shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums">
            {q.places.length}
            {q.truncated ? "+" : ""}{" "}
            {q.places.length === 1 ? "result" : "results"}
          </span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4">
          {q.error ? (
            <p className="text-destructive bg-destructive/5 rounded-xl p-3 text-xs">
              {q.error}
            </p>
          ) : !hasResults ? (
            <p className="text-muted-foreground bg-muted/40 rounded-xl p-3 text-xs">
              {q.rawCount > 0
                ? `${q.rawCount} ${q.rawCount === 1 ? "place" : "places"} found, but ${
                    q.rawCount === 1 ? "it was" : "all were"
                  } below your quality filters. Loosen the filters to see ${
                    q.rawCount === 1 ? "it" : "them"
                  }.`
                : "No results."}
            </p>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                {filteredOut > 0 ? (
                  <span className="text-muted-foreground text-xs">
                    Showing {q.places.length} of {q.rawCount} — {filteredOut}{" "}
                    below your quality filters
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() =>
                    onCopy(q.places.map((p) => p.id).join("\n"), copyKey)
                  }
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition"
                >
                  {copied === copyKey ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied === copyKey
                    ? "Copied"
                    : `Copy ${q.places.length} ID${q.places.length === 1 ? "" : "s"}`}
                </button>
              </div>
              <ul className="border-border divide-border bg-background divide-y rounded-xl border">
                {q.places.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-1 gap-2 px-3 py-2 text-xs md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        <span className="truncate">
                          {p.displayName || "(no name)"}
                        </span>
                        {p.existsInMesita && (
                          <span className="bg-secondary/15 text-secondary inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                            <CheckCircle2 className="h-3 w-3" />
                            In Mesita
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {p.formattedAddress}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <RatingBadge place={p} />
                        {p.existsInMesita && (p.createdAt || p.updatedAt) && (
                          <p className="text-muted-foreground/80 truncate text-[11px]">
                            {p.createdAt && (
                              <>
                                · added{" "}
                                <span
                                  className="text-foreground/70 font-medium"
                                  title={p.createdAt}
                                >
                                  {formatShortDate(p.createdAt)}
                                </span>
                              </>
                            )}
                            {p.createdAt && p.updatedAt && " · "}
                            {p.updatedAt && (
                              <>
                                updated{" "}
                                <span
                                  className="text-foreground/70 font-medium"
                                  title={p.updatedAt}
                                >
                                  {formatShortDate(p.updatedAt)}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <code className="text-muted-foreground bg-muted/40 max-w-full truncate rounded-lg px-2 py-1 font-mono">
                      {p.id}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
