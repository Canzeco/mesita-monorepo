"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MAX_GOOGLE_PLACE_IDS } from "./google-place-ids";
import { ListPlus, Search } from "lucide-react";

import {
  Button,
  ChoicePill,
  Notice,
  RegionField,
  SectionCard,
  TextAreaField,
} from "@/components/admin-ui";
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
import { DISCOVERY_MAP_HREF } from "@/app/(app)/filters-config/nav";
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
  const [sentUpTo, setSentUpTo] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const parsed = useMemo(() => splitSearchBarInput(bar), [bar]);
  const queries = parsed.queries;
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
    if (running || unitCount === 0 || overLimit) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setSentUpTo(0);
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
  // The boxes take MAX_GOOGLE_PLACE_IDS at a time; the next tap sends the rest.
  const sendFrom = sentUpTo < allPlaceIds.length ? sentUpTo : 0;
  const sendIds = allPlaceIds.slice(sendFrom, sendFrom + MAX_GOOGLE_PLACE_IDS);

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
        className="flex flex-col gap-3"
      >
        <TextAreaField
          label="Google search"
          value={bar}
          onChange={setBar}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
          placeholder="One query per line, or Google Place IDs"
          aria-label="Google search, one query per line"
          spellCheck={false}
          rows={4}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">
            {queries.length} {queries.length === 1 ? "query" : "queries"}
            {parsed.placeIds.length > 0
              ? ` · ${parsed.placeIds.length} Place ID${parsed.placeIds.length === 1 ? "" : "s"}`
              : ""}
            {overLimit ? ` · over the ${MAX_QUERIES} max` : ""}
            {unitCount > 0 ? ` · ~${estimatedApiCalls} Google API calls` : ""}
            {" · "}
            <Link
              href={DISCOVERY_MAP_HREF}
              className="text-foreground underline-offset-2 hover:underline"
            >
              Discovery › place rules
            </Link>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Results per query" className="flex flex-wrap items-center gap-1.5">
              {RESULTS_OPTIONS.map((o) => (
                <ChoicePill
                  key={o.value}
                  active={o.value === maxResults}
                  disabled={running}
                  onClick={() => setMaxResults(o.value)}
                >
                  {o.label}
                </ChoicePill>
              ))}
            </div>
            <RegionField value={regionCode} onChange={setRegionCode} disabled={running} />
            <Button
              type="submit"
              size="field"
              pending={running}
              disabled={unitCount === 0 || overLimit}
              icon={<Search aria-hidden className="h-4 w-4" />}
            >
              {running ? "Searching…" : "Search"}
            </Button>
          </div>
        </div>
      </form>

      {error && (
        <Notice className="mt-8">
          <p>Search failed</p>
          <p className="mt-1 font-normal">{error}</p>
        </Notice>
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
            <Button
              tone="secondary"
              icon={<ListPlus aria-hidden className="h-4 w-4" />}
              onClick={() => {
                setSentUpTo(sendFrom + sendIds.length);
                onSendIds(sendIds);
              }}
            >
              Send{" "}
              {allPlaceIds.length > MAX_GOOGLE_PLACE_IDS
                ? `${sendFrom + 1}–${sendFrom + sendIds.length} of ${allPlaceIds.length}`
                : allPlaceIds.length}{" "}
              {allPlaceIds.length === 1 ? "ID" : "IDs"} to the boxes below
            </Button>
          )}

          {failedQueries.length > 0 && (
            <Notice>
              <p>
                {failedQueries.length}{" "}
                {failedQueries.length === 1 ? "query" : "queries"} failed
              </p>
              <ul className="mt-2 space-y-1 font-normal">
                {failedQueries.map((q) => (
                  <li key={q.query} className="text-xs">
                    <span className="font-mono font-medium">“{q.query}”</span>{" "}
                    — {q.error}
                  </li>
                ))}
              </ul>
            </Notice>
          )}

          {result.mesitaLookupError && (
            <Notice tone="warning">
              <p>Couldn&apos;t check which places are already in Mesita</p>
              <p className="mt-1 font-normal">{result.mesitaLookupError}</p>
            </Notice>
          )}

          <PlacesMap places={result.uniquePlaces} />

          <SectionCard title="By query">
            <ul className="divide-border mt-3 divide-y">
              {result.queries.map((q) => (
                <QueryRow
                  key={q.query}
                  q={q}
                  copied={copied}
                  onCopy={copyText}
                />
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
