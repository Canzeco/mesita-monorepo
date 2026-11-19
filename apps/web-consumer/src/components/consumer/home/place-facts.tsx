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

/**
 * ONE FACT PER LINE (Pato, 2026-11-18, MESITA-4418: "make the text bigger,
 * and add more text: Name / Google Category / Price Range, Google Stars /
 * Opening Status / Zone, distance / BUTTONS"): Home's row card under the
 * name, 14px, each line truncated, a missing fact dropping its line:
 *
 *   Taco Restaurant                 the Google category (back from MESITA-3786)
 *   $$ · ★ 4.7 (8.6K)
 *   ◷ Open · until 3:00             or Closed · opens 13:00
 *   ➤ 0.4 km · Tecnológico          distance first (MESITA-4422)
 */
export function PlaceFactsLines({ place }: { place: Place }) {
  const facts = cardFacts(place);
  const overview = enrichPlaceOverview(place);
  const price = facts.price ?? priceSymbolsFromRange(place.price_range);
  const icon = "h-3.5 w-3.5 shrink-0";
  const line = "flex min-w-0 items-center gap-1 truncate";
  const zone = place.zone?.trim() || null;
  const until = facts.open === true ? overview.closes_at : null;
  const opens = facts.open === false ? overview.opens_at : null;
  return (
    <div className="text-foreground flex min-w-0 flex-col gap-0.5 text-sm leading-5" data-row-facts>
      {facts.kind ? (
        <p className="text-muted-foreground truncate" data-row-kind>
          {facts.kind}
        </p>
      ) : null}
      {price || facts.rating ? (
        <p className={line}>
          {price ? <span className="text-fact-price font-semibold">{price}</span> : null}
          {price && facts.rating ? <span className="text-muted-foreground">·</span> : null}
          {facts.rating ? (
            <span className="flex min-w-0 items-center gap-0.5 truncate">
              <Star className={cn(icon, "fill-fact-star text-fact-star")} aria-hidden />
              {facts.rating}
              {facts.reviews ? (
                <span className="text-muted-foreground">({facts.reviews})</span>
              ) : null}
            </span>
          ) : null}
        </p>
      ) : null}
      {facts.open !== null ? (
        <p className={line} data-row-open>
          <Clock
            // ONE GREEN (Pato, MESITA-4423: "money and time must be same
            // green"): Open wears the $$'s green.
            className={cn(icon, facts.open ? "text-fact-price" : "text-fact-closed")}
            strokeWidth={2.5}
            aria-hidden
          />
          <span className={cn("font-semibold", facts.open ? "text-fact-price" : "text-fact-closed")}>
            {facts.open ? "Open" : "Closed"}
          </span>
          {until || opens ? (
            <span className="text-muted-foreground truncate">
              · {until ? `until ${until}` : `opens ${opens}`}
            </span>
          ) : null}
        </p>
      ) : null}
      {zone || facts.distance ? (
        <p className={cn(line, "text-muted-foreground")} data-row-where>
          <Navigation className={cn(icon, "fill-fact-distance text-fact-distance")} aria-hidden />
          <span className="truncate">{[facts.distance, zone].filter(Boolean).join(" · ")}</span>
        </p>
      ) : null}
    </div>
  );
}
