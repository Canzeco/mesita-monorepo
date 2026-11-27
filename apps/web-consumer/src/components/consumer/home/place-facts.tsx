"use client";

import { Fragment, type ReactNode } from "react";
import { Clock, Navigation, Star } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
import { cardFacts } from "@/components/consumer/place-card";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";

/** $ to $$$$ from a price range's low end ("$200–300MX" → $$), on the
 *  place screen's level ranges (place-price.ts LEVEL_RANGES). */
export function priceSymbolsFromRange(
  range: string | null | undefined,
): string | null {
  const low = Number(range?.match(/[\d.,]+/)?.[0]?.replace(/,/g, ""));
  if (!Number.isFinite(low) || low <= 0) return null;
  const level = low < 200 ? 1 : low < 300 ? 2 : low < 500 ? 3 : 4;
  return "$".repeat(level);
}

type Cell = { key: string; node: ReactNode };

/**
 * ONE RUN OF FACTS (Pato, MESITA-3669: "$$$$ from 1 to 4 … then the number
 * of stars … then if open or closed, don't mention the hour … then the
 * distance", "todo seguido"): `$$ · ★ 4.7 (8.6K) · Open · 0.4 km`, wrapping
 * over 2–3 lines; a missing fact drops with its dot. NO GOOGLE CATEGORY
 * (Pato, MESITA-3786: "don't show the google category, to make it look
 * cleaner"): the kind ("Taco Restaurant") and its family-word fallback are
 * gone; the rail beside the rows already says the family.
 * Places 3.0's row card and Places 4.0's rail card print it the same way
 * (MESITA-3670).
 */
export function PlaceFactsRun({
  place,
  className,
}: {
  place: Place;
  className?: string;
}) {
  const facts = cardFacts(place);
  // $ to $$$$, never the amount: price_level, else the range's low end.
  const price = facts.price ?? priceSymbolsFromRange(place.price_range);
  const icon = "inline h-3 w-3 shrink-0 align-[-2px]";
  const candidates: (Cell | false | null | undefined | "")[] = [
    price && {
      key: "price",
      node: <span className="font-semibold">{price}</span>,
    },
    facts.rating && {
      key: "stars",
      node: (
        <span className="whitespace-nowrap">
          <Star
            className={cn(icon, "fill-foreground mr-0.5")}
            aria-hidden
          />
          {facts.rating}
          {facts.reviews ? ` (${facts.reviews})` : ""}
        </span>
      ),
    },
    facts.open !== null && {
      key: "open",
      node: (
        <span className="whitespace-nowrap">
          <Clock
            className={cn(icon, "mr-0.5")}
            strokeWidth={2.5}
            aria-hidden
          />
          {facts.open ? "Open" : "Closed"}
        </span>
      ),
    },
    facts.distance && {
      key: "distance",
      node: (
        <span className="whitespace-nowrap">
          <Navigation
            className={cn(icon, "fill-foreground mr-0.5")}
            aria-hidden
          />
          {facts.distance}
        </span>
      ),
    },
  ];
  const cells = candidates.filter((c): c is Cell => Boolean(c));
  if (cells.length === 0) return null;
  return (
    <p
      className={cn("text-foreground text-xs leading-5", className)}
      data-row-facts
    >
      {cells.map((c, n) => (
        <Fragment key={c.key}>
          {n > 0 ? <span className="text-muted-foreground"> · </span> : null}
          {c.node}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * THREE BLACK LINES under the name (Pato, 2026-11-27, MESITA-5041):
 *
 *   $ · Taco Restaurant
 *   ★ 4.4 (3.9K) · 0.3 km
 *   Open · until 05:00
 *
 * The neighborhood is gone. Every word and icon is ink. Reserve and
 * Discounts, outside this block, are the card's only color.
 */
export function PlaceFactsLines({ place }: { place: Place }) {
  const facts = cardFacts(place);
  const overview = enrichPlaceOverview(place);
  const price = facts.price ?? priceSymbolsFromRange(place.price_range);
  const icon = "h-3.5 w-3.5 shrink-0";
  const line = "flex min-w-0 items-center gap-1 truncate";
  const until = facts.open === true ? overview.closes_at : null;
  const opens = facts.open === false ? overview.opens_at : null;
  return (
    <div className="text-foreground flex min-w-0 flex-col gap-0.5 text-sm leading-5" data-row-facts>
      {price || facts.kind ? (
        <p className={line} data-row-kind>
          {price ? <span className="shrink-0 font-semibold">{price}</span> : null}
          {price && facts.kind ? <span>·</span> : null}
          {facts.kind ? <span className="truncate">{facts.kind}</span> : null}
        </p>
      ) : null}
      {facts.rating || facts.distance ? (
        <p className={line} data-row-stars>
          {facts.rating ? (
            <span className="flex shrink-0 items-center gap-0.5">
              <Star className={cn(icon, "fill-foreground")} aria-hidden />
              {facts.rating}
              {facts.reviews ? <span>({facts.reviews})</span> : null}
            </span>
          ) : null}
          {facts.rating && facts.distance ? <span>·</span> : null}
          {facts.distance ? <span className="truncate">{facts.distance}</span> : null}
        </p>
      ) : null}
      {facts.open !== null ? (
        <p className={line} data-row-open>
          <Clock className={icon} strokeWidth={2.5} aria-hidden />
          <span className="shrink-0 font-semibold">{facts.open ? "Open" : "Closed"}</span>
          {until || opens ? (
            <span className="truncate">· {until ? `until ${until}` : `opens ${opens}`}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
