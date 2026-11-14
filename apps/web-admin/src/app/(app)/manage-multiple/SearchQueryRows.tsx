"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ChevronRight, Copy, Star } from "lucide-react";

import { DISCOVERY_MAP_HREF } from "@/app/(app)/filters-config/nav";
import { Button, Chip, FOCUS_RING_CLASS, Notice } from "@/components/admin-ui";
import { formatShortDate } from "@/lib/format";
import type { PlaceLite, QueryResult } from "@/lib/places-types";

function RatingBadge({ place }: { place: PlaceLite }) {
  if (place.rating === null && place.userRatingCount === null) {
    return (
      <span className="text-muted-foreground/70 inline-flex items-center gap-1 type-label">
        no Google rating yet
      </span>
    );
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 type-label">
      <Star aria-hidden className="text-warning h-3 w-3 fill-current" />
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

export function QueryRow({
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
      {/* A native disclosure: the summary is the row, the body mounts only
          while open. */}
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary
        className={`hover:bg-muted/40 flex w-full cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-3 text-left transition [&::-webkit-details-marker]:hidden ${FOCUS_RING_CLASS}`}
      >
        <ChevronRight
          className={
            "text-muted-foreground h-4 w-4 shrink-0 transition-transform " +
            (open ? "rotate-90" : "")
          }
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {q.query}
        </span>
        {/* w-full drops the counts onto their own line on a phone. Three
            shrink-0 pills beside the query left it about 30px wide — every
            search read as "…" and the row said nothing about itself. */}
        <span className="flex w-full flex-wrap items-center gap-2 pl-7 sm:w-auto sm:pl-0">
          {mesitaHits > 0 && !q.error && (
            <Chip tone="success">
              <CheckCircle2 aria-hidden className="h-3 w-3" />
              {mesitaHits} in Mesita
            </Chip>
          )}
          {filteredOut > 0 && !q.error && <Chip>{filteredOut} filtered</Chip>}
          {q.error ? (
            <Chip tone="danger">error</Chip>
          ) : (
            <Chip>
              {q.places.length}
              {q.truncated ? "+" : ""}{" "}
              {q.places.length === 1 ? "result" : "results"}
            </Chip>
          )}
        </span>
      </summary>
      {open && (
        <div className="px-4 pb-4">
          {q.error ? (
            <Notice>{q.error}</Notice>
          ) : !hasResults ? (
            <p className="text-muted-foreground bg-muted/40 rounded-xl p-3 text-xs">
              {q.rawCount > 0 ? (
                <>
                  {q.rawCount} {q.rawCount === 1 ? "place" : "places"} found,
                  but {q.rawCount === 1 ? "it is" : "none are"} allowed by{" "}
                  <Link
                    href={DISCOVERY_MAP_HREF}
                    className="text-foreground underline underline-offset-2"
                  >
                    Discovery&apos;s place rules
                  </Link>{" "}
                  (Mesita&apos;s place types, or a stored Google floor). This row only —
                  other queries in the batch still stand.
                </>
              ) : (
                "No results."
              )}
            </p>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                {filteredOut > 0 ? (
                  <span className="text-muted-foreground text-xs">
                    Showing {q.places.length} of {q.rawCount} — {filteredOut}{" "}
                    blocked by{" "}
                    <Link
                      href={DISCOVERY_MAP_HREF}
                      className="text-foreground underline underline-offset-2"
                    >
                      Discovery&apos;s place rules
                    </Link>
                  </span>
                ) : (
                  <span />
                )}
                <Button
                  tone="ghost"
                  size="sm"
                  onClick={() =>
                    onCopy(q.places.map((p) => p.id).join("\n"), copyKey)
                  }
                  icon={
                    copied === copyKey ? (
                      <Check aria-hidden className="h-3.5 w-3.5" />
                    ) : (
                      <Copy aria-hidden className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {copied === copyKey
                    ? "Copied"
                    : `Copy ${q.places.length} ID${q.places.length === 1 ? "" : "s"}`}
                </Button>
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
                          <Chip tone="success" className="shrink-0">
                            <CheckCircle2 aria-hidden className="h-3 w-3" />
                            In Mesita
                          </Chip>
                        )}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {p.formattedAddress}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <RatingBadge place={p} />
                        {p.existsInMesita && (p.createdAt || p.updatedAt) && (
                          <p className="text-muted-foreground/80 truncate type-label">
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
                    <code className="text-muted-foreground bg-muted/40 max-w-full truncate rounded-xl px-2 py-1 font-mono">
                      {p.id}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      </details>
    </li>
  );
}
