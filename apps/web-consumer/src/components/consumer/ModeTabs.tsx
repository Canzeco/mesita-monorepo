"use client";

// Home's header (Pato, MESITA-2470: "where is the mesita logo in the main
// page … just in the header to give them brand identity"):
//
//   Mesita                                 [📍 Tecnologico ⌄]
//
// One 52px row, 16px sides, the name on the left, the location on the right
// (LocationPicker; MESITA-2405 made it the header's only control). WHITE,
// the name in ink and the box in the quiet grey, a hairline under it (MESITA-2538), and the
// Places | Social strip under it is white too: one light top block, and the
// darker thing is the family column (Pato, MESITA-2537: "making the header
// white and the second header also light. and the lateral bark darker").
// MESITA-2531 had a darker strip, MESITA-2529 a stone header, MESITA-2524
// ink over white tabs; MESITA-2476's brand pink was sent back.
// No logo for now (MESITA-2480, Pato: "just write mesita with a slightly
// different font that make it look like a logo … dont create logos yet"):
// the word "Mesita" in Outfit, a geometric sans with a one-storey a,
// bold and tight. The flame, the table M and a molcajete were each rejected
// (MESITA-2473, MESITA-2476, MESITA-2480).
// Home draws it from app/(shell)/(discovery)/home/layout.tsx and the Reward tab
// from app/(shell)/pay/page.tsx (MESITA-3214, Pato: "same header resuded in home
// and in pay"); Search has its own header (SearchHeader: locate · bar · Ask AI, then family
// chips), so Home's never paints over the map (MESITA-1616). It was
// DiscoverModeNav.

import type { ReactNode } from "react";
import { HOME_WORDMARK_CLASS } from "@/components/brand/home-wordmark";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";
import { useSavedLocationBackfill } from "@/lib/use-saved-location-backfill";

/** The band: white, sticky, a hairline under it dividing it from the white
 *  tab strip, as Search's header divides from its chips (Pato, MESITA-2538:
 *  "try adding a line dividing mesita header with the other shit"). */
export const BRAND_HEADER_CLASS =
  "border-border bg-card text-foreground sticky top-0 z-20 shrink-0 border-b";

/** The white band with the word "Mesita", then the tab's own control (Home:
 *  the location box). */
export function BrandHeader({ children }: { children?: ReactNode }) {
  return (
    <div className={BRAND_HEADER_CLASS}>
      {/* The location box's right margin is its 8px top and bottom (Pato,
          2026-11-24, MESITA-4847); 16px before. */}
      <div className="flex h-14 items-center gap-3 pr-2 pl-4" data-home-header>
        <span
          className={HOME_WORDMARK_CLASS}
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
 *  Achromatic: ink on white (MESITA-2480, MESITA-2531). */
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
