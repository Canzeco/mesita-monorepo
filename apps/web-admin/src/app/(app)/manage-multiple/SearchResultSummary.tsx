import Link from "next/link";
import { Check, Copy, Download, SlidersHorizontal, Star } from "lucide-react";

import { Button, Chip, SectionCard, Stat } from "@/components/admin-ui";
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
    <SectionCard
      title="Result"
      right={
        <>
          <Button
            tone="secondary"
            onClick={() =>
              onCopy(result.uniquePlaces.map((p) => p.id).join("\n"), "all")
            }
            icon={
              copied === "all" ? (
                <Check aria-hidden className="h-4 w-4" />
              ) : (
                <Copy aria-hidden className="h-4 w-4" />
              )
            }
          >
            {copied === "all" ? "Copied" : "Copy all IDs"}
          </Button>
          <Button
            tone="secondary"
            onClick={onDownload}
            icon={<Download aria-hidden className="h-4 w-4" />}
          >
            Download CSV
          </Button>
        </>
      }
    >
      <Stat
        className="mt-4"
        label={`unique ${result.uniqueCount === 1 ? "Place ID" : "Place IDs"}`}
        value={result.uniqueCount.toLocaleString()}
        hint={
          <>
            from {result.queries.length}{" "}
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
          </>
        }
      />
      {filtersActive && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Link
            href={DISCOVERY_MAP_HREF}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 type-eyebrow"
          >
            <SlidersHorizontal aria-hidden className="h-3 w-3" />
            Discovery › place rules
          </Link>
          {result.minRating > 0 && (
            <Chip>
              <Star aria-hidden className="h-3 w-3 fill-current" />
              {result.minRating.toFixed(1)}+
            </Chip>
          )}
          {result.minUserRatingCount > 0 && (
            <Chip>{result.minUserRatingCount.toLocaleString()}+ reviews</Chip>
          )}
          <span className="text-muted-foreground">
            · {result.filteredOutCount.toLocaleString()} of{" "}
            {totalRawCount.toLocaleString()} dropped below the bar
          </span>
        </div>
      )}
    </SectionCard>
  );
}
