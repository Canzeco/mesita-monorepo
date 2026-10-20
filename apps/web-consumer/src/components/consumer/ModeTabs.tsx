"use client";

// Home's header (Pato, MESITA-2470: "where is the mesita logo in the main
// page … just in the header to give them brand identity"):
//
//   Mesita                                 [📍 Tecnologico ⌄]
//
// One 52px row, 16px sides, the name on the left, the location on the right
// (LocationPicker; MESITA-2405 made it the header's only control). White
// like the bottom bar, its hairline under it (MESITA-2409); MESITA-2476
// painted it the brand pink and Pato sent it back ("keep the white style").
// No logo for now (MESITA-2480, Pato: "just write mesita with a slightly
// different font that make it look like a logo … dont create logos yet"):
// the word "Mesita" in Outfit, a geometric sans with a one-storey a,
// bold and tight, in ink. The flame, the table M and a molcajete were each
// rejected (MESITA-2473, MESITA-2476, MESITA-2480).
// Social and Favorites are rows of the catalog's column (CatalogRails).
// Home draws it from app/(shell)/(discovery)/home/layout.tsx; Search has its
// own header (SearchHeader: locate · bar · Ask AI, then family chips), so
// Home's never paints over the map (MESITA-1616). It was DiscoverModeNav.

import { Outfit } from "next/font/google";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";

const wordmarkFont = Outfit({ subsets: ["latin"], weight: "700" });

/** The header's name, set as type, not a drawn logo (MESITA-2480). */
export const HOME_WORDMARK_CLASS =
  "text-foreground shrink-0 text-2xl leading-none tracking-[-0.03em] select-none";

/** Home's header: the name, then the location picker (MESITA-2470).
 *  Ink on white: the consumer app is achromatic (MESITA-2480). */
export function ModeTabs() {
  return (
    <div className="border-border bg-card/95 sticky top-0 z-20 shrink-0 border-b backdrop-blur">
      <div className="flex h-[52px] items-center gap-3 px-4" data-home-header>
        <span
          className={`${wordmarkFont.className} ${HOME_WORDMARK_CLASS}`}
          data-home-wordmark
        >
          Mesita
        </span>
        <LocationPicker />
      </div>
    </div>
  );
}
