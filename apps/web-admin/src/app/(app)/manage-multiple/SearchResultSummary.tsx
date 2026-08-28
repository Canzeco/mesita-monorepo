import Link from "next/link";
import { Check, Copy, Download, SlidersHorizontal, Star } from "lucide-react";

import { DISCOVERY_MAP_HREF } from "@/app/(app)/filters-config/nav";
import type { SearchResponse } from "@/lib/places-types";

export function ResultSummary({
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
    <section className="border-border bg-pink-gradient shadow-card relative overflow-hidden rounded-2xl border p-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-secondary type-eyebrow">
            Result
          </p>
          <p className="font-display mt-1 text-5xl font-semibold tracking-tight md:text-6xl">
            {result.uniqueCount.toLocaleString()}
          </p>
          <p className="text-foreground/70 mt-1 text-sm">
            unique {result.uniqueCount === 1 ? "Place ID" : "Place IDs"} · from{" "}
            {result.queries.length}{" "}
            {result.queries.length === 1 ? "query" : "queries"}
            {duplicatesCount > 0 && <> · {duplicatesCount} duplicates filtered</>}
            {result.regionCode ? <> · region {result.regionCode}</> : null}
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
              <Link
                href={DISCOVERY_MAP_HREF}
                className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 type-eyebrow"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Discovery › Map
              </Link>
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
            className="bg-background hover:bg-background/80 inline-flex items-center gap-2 rounded-xl border border-transparent px-3.5 py-2 text-sm font-medium shadow-card transition"
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
            className="bg-background hover:bg-background/80 inline-flex items-center gap-2 rounded-xl border border-transparent px-3.5 py-2 text-sm font-medium shadow-card transition"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>
      </div>
    </section>
  );
}
