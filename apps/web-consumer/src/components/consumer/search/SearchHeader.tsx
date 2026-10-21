"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape):
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ✦ )   one white band …
//   ─────────────────── hairline ──────────────────────
//   (▦ All) (○ Coffee) (○ Breakfast) (○ Quick bite) …   … one hairline under
//   ─────────────────── map ───────────────────────────
//
// The bar's row: the locate disc, the query bar, the Ask AI pill (→ Search ›
// Chat, Soon) — two equal 36px discs around the bar (Pato, MESITA-2433: "location
// must be kinda symmetrical to ask ai"). One token set for every control lives
// in header-classes.ts. Under it one horizontal chip row: All, then every
// family, each with its line icon (MESITA-2478: line icons, not emoji —
// "emojis uses color and that takes attention"). NO NEARBY, NO POPULAR (Pato,
// MESITA-2499: "its all based on the map … the zoom is decided by the map";
// MESITA-2502: "its only All and then all the famileis. easy peasy"): the map
// is the where, so the set is the visible map ranked best first, and a chip
// is only the what. ONE pick at a time: All is every family (lit when none is
// picked); tapping the lit family again also goes back to All. Sent as the
// server-side `familyKeys`. There is no Filters disc and
// no sheet (Pato, MESITA-2417: "Its just all and thats it"); the Google
// reviews minimum is the operator's, Admin › Discovery › Area.
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
import { FamilyIcon } from "@/lib/family-icons";
import {
  clearMapFamilies,
  selectMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_OFF, CHIP_ON, HEADER_PILL } from "./header-classes";

/** A chip's line icon, never an emoji (MESITA-2478): 1.75 stroke, 2.25 when
 *  on — BottomNav's pair. */
const CHIP_ICON = "h-4 w-4 shrink-0";

export function SearchHeader({
  locate,
  bar,
  chipsHidden = false,
  children,
}: {
  /** The locate disc, at the left of the bar's row. */
  locate: ReactNode;
  /** The query bar; it takes what the two buttons leave. */
  bar: ReactNode;
  /** While the bar is querying the chip row is not drawn (Pato,
   *  MESITA-2487: "make the bar of categories disappear when searching");
   *  the results then hang just under the bar's row. */
  chipsHidden?: boolean;
  /** Over the chips: the bar's results, the load error. */
  children?: ReactNode;
}) {
  const filters = useMapFilters();
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
          the white. A full-width hairline splits the two rows, each with
          10px above and below (Pato, MESITA-2479: "top box, line, bottom
          box"). */}
      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
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
      <div
        className={cn("relative", !chipsHidden && "border-border border-t")}
        data-search-chip-band
      >
        {chipsHidden ? null : (
          <nav
            aria-label="Families"
            className="scrollbar-hide flex items-center gap-2 overflow-x-auto overscroll-x-contain px-3 py-2.5"
            data-search-chips
          >
            {/* The row starts on All, no clay bar before it (Pato,
                MESITA-2503: "remove … the vertical bluye line"). */}
            <button
              type="button"
              onClick={clearMapFamilies}
              aria-pressed={everyFamily}
              className={cn(CHIP, everyFamily ? CHIP_ON : CHIP_OFF)}
              data-search-chip-all
            >
              <FamilyIcon
                name="all"
                className={CHIP_ICON}
                strokeWidth={everyFamily ? 2.25 : 1.75}
              />
              {/* Top, not All: the best-ranked pool (MESITA-2534). */}
              <span>Top</span>
            </button>
            {FILTERABLE_PLACE_FAMILIES.map((family) => {
              const on =
                filters.familyKeys.length === 1 &&
                filters.familyKeys[0] === family.key;
              return (
                <button
                  key={family.key}
                  type="button"
                  // Picking the lit family again goes back to All.
                  onClick={() => selectMapFamily(family.key)}
                  aria-pressed={on}
                  className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                >
                  <FamilyIcon
                    name={family.key}
                    className={CHIP_ICON}
                    strokeWidth={on ? 2.25 : 1.75}
                  />
                  <span>{family.label}</span>
                </button>
              );
            })}
          </nav>
        )}
        {children ? (
          <div
            className={cn(
              "absolute inset-x-3 top-0 z-10 flex flex-col gap-2",
              chipsHidden && "pt-2",
            )}
            data-search-over-chips
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
