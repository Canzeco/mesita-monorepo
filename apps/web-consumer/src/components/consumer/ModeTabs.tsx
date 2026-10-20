"use client";

// Home's header (Pato, MESITA-2470: "where is the mesita logo in the main
// page … just in the header to give them brand identity"):
//
//   [🔥 mesita.]                            📍 Tecnologico ⌄
//
// "A · Quiet" (Pato picked it from four mockups, MESITA-2473: the 28px logo
// beside a grey oval "looks like shit"): one 52px row, 16px sides, the
// lockup at 22px on the left, the location as plain text on the right
// (LocationPicker; MESITA-2405 made it the header's only control).
// Social and Favorites are rows of the catalog's column (CatalogRails).
// White like the bottom bar, its hairline under it (MESITA-2409). Home draws it
// from app/(shell)/(discovery)/home/layout.tsx; Search has its own
// header (SearchHeader: locate · bar · Ask AI, then family chips), so
// Home's never paints over the map (MESITA-1616). It was DiscoverModeNav.

import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";

/** Home's header: the Mesita logo, then the location picker (MESITA-2470).
 *  Ink, not pink: the consumer app is achromatic. Same strip as Search's. */
export function ModeTabs() {
  return (
    <div className="border-border bg-card/95 sticky top-0 z-20 shrink-0 border-b backdrop-blur">
      <div className="flex h-[52px] items-center gap-3 px-4" data-home-header>
        <MesitaLogo className="text-foreground h-[22px] w-auto shrink-0" />
        <LocationPicker />
      </div>
    </div>
  );
}
