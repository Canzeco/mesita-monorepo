"use client";

import { Fragment, type ReactNode } from "react";
import { Clock, Navigation, Star } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
import { cardFacts } from "@/components/consumer/place-card";

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
      node: <span className="text-fact-price font-semibold">{price}</span>,
    },
    facts.rating && {
      key: "stars",
      node: (
        <span className="whitespace-nowrap">
          <Star
            className={cn(icon, "fill-fact-star text-fact-star mr-0.5")}
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
            className={cn(
              icon,
              "mr-0.5",
              facts.open ? "text-fact-open" : "text-fact-closed",
            )}
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
            className={cn(icon, "fill-fact-distance text-fact-distance mr-0.5")}
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
