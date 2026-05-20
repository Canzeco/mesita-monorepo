"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Play,
  Download,
  ChevronRight,
  MapPin,
} from "lucide-react";
import {
  APIProvider,
  Map,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

type PlaceLite = {
  id: string;
  displayName: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
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

const MAX_QUERIES = 200;
const MAX_RESULTS = 50;
const MIN_RESULTS = 1;
const PAGE_SIZE = 20;

// Google Places Text Search pricing (SKU model effective 2025-03-01).
// The backend field mask includes places.location, which lands every
// request in the Text Search Pro SKU regardless of the other fields.
// Pricing for the 0–100K monthly tier — beyond that the tier rate
// drops, so this is a worst-case estimate. The first 5,000 Pro requests
// each month are free, shared across the whole project; surfaced in
// the tooltip rather than discounted from the headline number, since
// the remaining free quota isn't visible from the browser.
const PRICE_PER_REQUEST_USD = 0.032;
const FREE_PRO_REQUESTS_PER_MONTH = 5000;

const MAP_HEIGHT_PX = 440;
const MAP_DEFAULT_CENTER = { lat: 23.6345, lng: -102.5528 };
const MAP_DEFAULT_ZOOM = 5;
const MAP_FIT_BOUNDS_PADDING_PX = 48;
const MARKER_FILL_COLOR = "#E91E63";
const MARKER_STROKE_COLOR = "#FFFFFF";
const MARKER_STROKE_WIDTH = 2;
const MARKER_SCALE = 6;

const EXAMPLE_QUERIES = [
  "Mejores restaurantes en San Pedro",
  "Mezcalerías en Oaxaca",
  "Coffee shops in Mexico City",
];

export default function BulkSearchUnitsPage() {
  const [queriesText, setQueriesText] = useState("");
  const [regionCode, setRegionCode] = useState("MX");
  const [maxResults, setMaxResults] = useState(MAX_RESULTS);
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
  const estimatedApiCalls =
    queries.length * Math.ceil(maxResults / PAGE_SIZE);
  const estimatedCostUsd = estimatedApiCalls * PRICE_PER_REQUEST_USD;
  const failedQueries = result?.queries.filter((q) => q.error !== null) ?? [];
  const totalRawCount =
    result?.queries.reduce((n, q) => n + q.places.length, 0) ?? 0;
  const duplicatesCount = result ? totalRawCount - result.uniqueCount : 0;

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

  function downloadCsv() {
    if (!result) return;
    const rows: string[] = ["query,place_id,name,address"];
    for (const q of result.queries) {
      for (const p of q.places) {
        rows.push(
          [q.query, p.id, p.displayName, p.formattedAddress]
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
    <div className="mx-auto max-w-5xl px-8 pt-12 pb-24">
      {/* Header */}
      <header>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          Bulk search
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Find Place IDs in bulk
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
          One Google Places query per line. Each runs through the Places
          Text Search API; the deduped union of Place IDs comes back below.
        </p>
      </header>

      {/* Form */}
      <section className="mt-8 space-y-4">
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
                  title={`Google Places Text Search Pro SKU: $${PRICE_PER_REQUEST_USD.toFixed(3)} per request (0–100K monthly tier). The first ${FREE_PRO_REQUESTS_PER_MONTH.toLocaleString()} Pro requests each month are free across the whole project, so actual charges may be lower depending on prior usage this month. Each page of results counts as one billable request.`}
                >
                  ~{estimatedApiCalls} Google API call
                  {estimatedApiCalls === 1 ? "" : "s"}
                  {estimatedApiCalls > 0 && (
                    <>
                      {" · ~"}
                      {formatUsdEstimate(estimatedCostUsd)}
                    </>
                  )}
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

        {/* Three big param cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ParamCard
            label="Queries"
            footer={`of ${MAX_QUERIES} max`}
            tone={overLimit ? "warn" : "default"}
          >
            <span className="font-display text-5xl font-semibold tracking-tight tabular-nums">
              {queries.length}
            </span>
          </ParamCard>

          <ParamCard
            label="Results per query"
            footer={`${MIN_RESULTS}–${MAX_RESULTS} range`}
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
                  unique {result.uniqueCount === 1 ? "Place ID" : "Place IDs"}{" "}
                  · from {result.queries.length}{" "}
                  {result.queries.length === 1 ? "query" : "queries"}
                  {duplicatesCount > 0 && (
                    <> · {duplicatesCount} duplicates filtered</>
                  )}{" "}
                  · region {result.regionCode}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      result.uniquePlaces.map((p) => p.id).join("\n"),
                      "all",
                    )
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
                  onClick={downloadCsv}
                  className="bg-background hover:bg-background/80 inline-flex items-center gap-2 rounded-xl border border-transparent px-3.5 py-2 text-sm font-medium shadow-sm transition"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </button>
              </div>
            </div>
          </section>

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

          <MapPanel places={result.uniquePlaces} />

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
        {q.error ? (
          <span className="text-destructive bg-destructive/10 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
            error
          </span>
        ) : (
          <span className="text-foreground/70 bg-muted shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
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
              No results.
            </p>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-end">
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
                      <p className="truncate text-sm font-medium">
                        {p.displayName || "(no name)"}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {p.formattedAddress}
                      </p>
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

function formatUsdEstimate(amount: number): string {
  if (amount <= 0) return "$0";
  if (amount < 0.01) return "<$0.01";
  if (amount < 100) return `$${amount.toFixed(2)}`;
  return `$${Math.round(amount).toLocaleString()}`;
}

// Inline map style for a cleaner look — kills Google's default POI clutter
// (other restaurants, hotels, hospitals, attractions, transit lines, etc.)
// so our own markers stand out. We deliberately do NOT set a `mapId` on
// <Map>: when a Map ID is set, Google ignores the `styles` array because
// styling is supposed to be configured cloud-side. Without `mapId` we lose
// AdvancedMarker support, so the markers are drawn imperatively via the
// classic google.maps.Marker class instead.
const CLEAN_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
];

function MapPanel({ places }: { places: PlaceLite[] }) {
  const mappable = useMemo(
    () => places.filter((p) => p.lat !== null && p.lng !== null),
    [places],
  );
  const missing = places.length - mappable.length;

  if (!GOOGLE_MAPS_KEY) {
    return (
      <section className="border-border bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
        <p className="font-medium text-foreground">Map unavailable</p>
        <p className="mt-1">
          NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY isn't set on this deployment.
        </p>
      </section>
    );
  }

  if (mappable.length === 0) {
    return (
      <section className="border-border bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
        <p className="font-medium text-foreground">No mappable results</p>
        <p className="mt-1">
          None of the returned places included coordinates.
        </p>
      </section>
    );
  }

  return (
    <section className="border-border bg-card shadow-elev overflow-hidden rounded-2xl border">
      <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="text-secondary h-4 w-4" />
          <h2 className="text-foreground text-xs font-medium tracking-[0.14em] uppercase">
            Map
          </h2>
        </div>
        <p className="text-muted-foreground text-xs">
          {mappable.length}{" "}
          {mappable.length === 1 ? "marker" : "markers"}
          {missing > 0 && (
            <> · {missing} without coordinates</>
          )}
        </p>
      </div>
      <div style={{ height: MAP_HEIGHT_PX }} className="w-full">
        <APIProvider apiKey={GOOGLE_MAPS_KEY}>
          <Map
            defaultCenter={MAP_DEFAULT_CENTER}
            defaultZoom={MAP_DEFAULT_ZOOM}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            clickableIcons={false}
            styles={CLEAN_MAP_STYLE}
          >
            <MapMarkers places={mappable} />
            <FitBoundsToPlaces places={mappable} />
          </Map>
        </APIProvider>
      </div>
    </section>
  );
}

function FitBoundsToPlaces({ places }: { places: PlaceLite[] }) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  useEffect(() => {
    if (!map || !coreLib || places.length === 0) return;
    const bounds = new coreLib.LatLngBounds();
    for (const p of places) {
      if (p.lat !== null && p.lng !== null) {
        bounds.extend({ lat: p.lat, lng: p.lng });
      }
    }
    if (bounds.isEmpty()) return;
    map.fitBounds(bounds, MAP_FIT_BOUNDS_PADDING_PX);
  }, [map, coreLib, places]);
  return null;
}

function MapMarkers({ places }: { places: PlaceLite[] }) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!map || !markerLib) return;
    const markers: google.maps.Marker[] = [];
    for (const p of places) {
      if (p.lat === null || p.lng === null) continue;
      const marker = new markerLib.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: MARKER_FILL_COLOR,
          fillOpacity: 1,
          strokeColor: MARKER_STROKE_COLOR,
          strokeWeight: MARKER_STROKE_WIDTH,
          scale: MARKER_SCALE,
        },
        optimized: true,
      });
      marker.addListener("click", () => {
        setOpenId((id) => (id === p.id ? null : p.id));
      });
      markers.push(marker);
    }
    return () => {
      for (const m of markers) {
        m.setMap(null);
      }
    };
  }, [map, markerLib, places]);

  const openPlace =
    openId === null ? null : places.find((p) => p.id === openId) ?? null;

  if (!openPlace || openPlace.lat === null || openPlace.lng === null) {
    return null;
  }

  return (
    <InfoWindow
      position={{ lat: openPlace.lat, lng: openPlace.lng }}
      onCloseClick={() => setOpenId(null)}
    >
      <div className="max-w-[240px] text-xs">
        <p className="text-foreground text-sm font-medium">
          {openPlace.displayName || "(no name)"}
        </p>
        <p className="text-muted-foreground mt-0.5">
          {openPlace.formattedAddress}
        </p>
        <p className="text-muted-foreground/70 mt-1 font-mono break-all">
          {openPlace.id}
        </p>
      </div>
    </InfoWindow>
  );
}
