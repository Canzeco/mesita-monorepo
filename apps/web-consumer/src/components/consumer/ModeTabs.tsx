"use client";

// Home's header (Pato, MESITA-2470: "where is the mesita logo in the main
// page … just in the header to give them brand identity"):
//
//   Mesita                                 [📍 Tecnologico ⌄]
//
// One 52px row, 16px sides, the name on the left, the location on the right
// (LocationPicker; MESITA-2405 made it the header's only control). LIGHT
// STONE: the hairline grey (`bg-border`), one step darker than the Places |
// Social strip under it, the name in ink and the location in a white box,
// so header, strip and tiles step from dark to light (Pato, MESITA-2529:
// "i don't really love the header. try a bit darker background", A of a
// board of four). It was white over the grey strip (MESITA-2526), ink over
// white tabs (MESITA-2524), white with a hairline (MESITA-2409,
// MESITA-2480); MESITA-2476's brand pink was sent back.
// No logo for now (MESITA-2480, Pato: "just write mesita with a slightly
// different font that make it look like a logo … dont create logos yet"):
// the word "Mesita" in Outfit, a geometric sans with a one-storey a,
// bold and tight. The flame, the table M and a molcajete were each rejected
// (MESITA-2473, MESITA-2476, MESITA-2480).
// Home draws it from app/(shell)/(discovery)/home/layout.tsx; Search
// has its own header (SearchHeader: locate · bar · Ask AI, then family
// chips), so Home's never paints over the map (MESITA-1616). It was
// DiscoverModeNav.

import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";
import { useSavedLocationBackfill } from "@/lib/use-saved-location-backfill";

const wordmarkFont = Outfit({ subsets: ["latin"], weight: "700" });

/** The band: light stone, sticky, over the lighter grey tab strip
 *  (MESITA-2529). */
export const BRAND_HEADER_CLASS =
  "bg-border text-foreground sticky top-0 z-20 shrink-0";

/** The header's name, set as type, not a drawn logo (MESITA-2480). */
export const HOME_WORDMARK_CLASS =
  "text-foreground shrink-0 text-2xl leading-none tracking-[-0.03em] select-none";

/** The stone band with the word "Mesita", then the tab's own control (Home:
 *  the location box). */
export function BrandHeader({ children }: { children?: ReactNode }) {
  return (
    <div className={BRAND_HEADER_CLASS}>
      <div className="flex h-[52px] items-center gap-3 px-4" data-home-header>
        <span
          className={`${wordmarkFont.className} ${HOME_WORDMARK_CLASS}`}
          data-home-wordmark
        >
          Mesita
        </span>
        {children}
      </div>
    </div>
  );
}

/** Home's header: the name, then the location picker (MESITA-2470).
 *  Achromatic: ink on stone grey (MESITA-2480, MESITA-2529). */
export function ModeTabs() {
  // Saved pins still waiting for their names get them here, once per Home
  // visit (MESITA-2501), whether or not the sheet opens.
  useSavedLocationBackfill();
  return (
    <BrandHeader>
      <LocationPicker />
    </BrandHeader>
  );
}
