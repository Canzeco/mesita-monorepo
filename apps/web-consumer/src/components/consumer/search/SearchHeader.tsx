"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape):
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ✦ )   one white band …
//   (📍 Nearby) (⭐ Popular) │ (☕ Coffee) (🥐 Breakfast) …   … one hairline under
//   ─────────────────── map ───────────────────────────
//
// The bar's row: the locate disc, the query bar, the Ask AI pill (→ Search ›
// Chat, Soon) — two equal 36px discs around the bar (Pato, MESITA-2433: "location
// must be kinda symmetrical to ask ai"). One token set for every control lives
// in header-classes.ts. Under it one horizontal chip row: Nearby and Popular, a hairline,
// then every family, each with its emoji (Pato, MESITA-2426: they replaced
// All). ONE pick at a time: Near is every family ranked Near, Popular every
// family ranked Popular, a family is that family ranked Near. Sent as the
// server-side `familyKeys` and `prefer` (MESITA-2425). There is no Filters disc and no sheet (Pato,
// MESITA-2417: "Its just all and thats it"); the Google reviews minimum is
// the operator's, Admin › Discovery › Area.
//
// ONE SOLID WHITE BAND for the bar's row and the chip row, like Home's
// header and the bottom bar (Pato, MESITA-2413; MESITA-2469 merged the grey
// chip band of MESITA-2462 back in). Solid, never translucent (MESITA-2462:
// "i don't like a transparent scrolling at all"); the controls are grey
// fills, so white-on-white (MESITA-2450) cannot happen. Nothing floats on
// the map. Every
// control is h-9: the discs, the bar and every chip (MESITA-2445). `children`
// (the bar's results, the load error) COVER the chip row and run on over the
// map (`absolute top-0` on the chip band's box; Pato, MESITA-2417: "the searchbar
// results must cover the categories").

import type { ReactNode } from "react";
import Link from "next/link";
import { BotMessageSquare } from "lucide-react";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import {
  clearMapFamilies,
  selectMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import { setAreaPrefer, useAreaPrefer } from "@/lib/use-area-prefer";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_OFF, CHIP_ON, HEADER_PILL } from "./header-classes";

/** Near and Popular, which replaced All (Pato, MESITA-2426). Popular wears
 *  the star All wore (MESITA-2422). */
export const EVERY_FAMILY_CHIPS = [
  { prefer: "near", emoji: "📍", label: "Nearby" },
  { prefer: "popular", emoji: "⭐", label: "Popular" },
] as const;

export function SearchHeader({
  locate,
  bar,
  children,
}: {
  /** The locate disc, at the left of the bar's row. */
  locate: ReactNode;
  /** The query bar; it takes what the two buttons leave. */
  bar: ReactNode;
  /** Over the chips: the bar's results, the load error. */
  children?: ReactNode;
}) {
  const filters = useMapFilters();
  const prefer = useAreaPrefer();
  const everyFamily = filters.familyKeys.length === 0;
  return (
    <div
      className="border-border bg-card relative z-30 shrink-0 border-b"
      data-search-header
      data-search-band
    >
      {/* ONE white band for the bar's row AND the chips, one hairline under
          both (Pato, MESITA-2469: Apple Maps / Instagram); the grey chip band
          of MESITA-2462 is gone. Controls are grey fills, so they read on
          the white. */}
      <div className="flex min-w-0 items-center gap-2 px-3 pt-2 pb-2">
        {locate}
        <div className="min-w-0 flex-1">{bar}</div>
        <Link
          href={CONSUMER_ROUTES.searchChat}
          className={HEADER_PILL}
          data-search-ask-ai
        >
          <BotMessageSquare
            className="h-4 w-4 shrink-0"
            strokeWidth={2}
            aria-hidden
          />
          <span>Ask AI</span>
        </Link>
      </div>
      <div className="relative" data-search-chip-band>
        <nav
          aria-label="Families"
          className="scrollbar-hide flex items-center gap-2 overflow-x-auto overscroll-x-contain px-3 pt-0 pb-2"
          data-search-chips
        >
          {EVERY_FAMILY_CHIPS.map((c) => {
            const on = everyFamily && prefer === c.prefer;
            return (
              <button
                key={c.prefer}
                type="button"
                onClick={() => {
                  clearMapFamilies();
                  setAreaPrefer(c.prefer);
                }}
                aria-pressed={on}
                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                data-area-prefer={c.prefer}
              >
                <span aria-hidden>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
          <span aria-hidden className="bg-border mx-0.5 h-6 w-px shrink-0" />
          {FILTERABLE_PLACE_FAMILIES.map((family) => {
            const on =
              filters.familyKeys.length === 1 &&
              filters.familyKeys[0] === family.key;
            return (
              <button
                key={family.key}
                type="button"
                onClick={() => {
                  // A family ranks Near; picking it again is Near.
                  setAreaPrefer("near");
                  selectMapFamily(family.key);
                }}
                aria-pressed={on}
                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
              >
                <span aria-hidden>{family.emoji}</span>
                <span>{family.label}</span>
              </button>
            );
          })}
        </nav>
        {children ? (
          <div
            className="absolute inset-x-3 top-0 z-10 flex flex-col gap-2"
            data-search-over-chips
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
