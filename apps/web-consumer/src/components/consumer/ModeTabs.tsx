"use client";

// Home's header (Pato, MESITA-2470: "where is the mesita logo in the main
// page … just in the header to give them brand identity"):
//
//   [🔥 mesita.]                            📍 Tecnologico ⌄
//
// One 52px row, 16px sides, the lockup at 22px on the left, the location
// on the right (LocationPicker; MESITA-2405 made it the header's only
// control). MESITA-2476 (Pato: "the header must be of other color"): the
// band is the brand colour (--brand-pink-deep, the brand folder's Jamaica)
// and the logo is the real one (the table M, white on it); it was white
// with a hairline (MESITA-2409) and the old flame in ink (MESITA-2473).
// Social and Favorites are rows of the catalog's column (CatalogRails).
// Home draws it
// from app/(shell)/(discovery)/discover/layout.tsx; Search has its own
// header (SearchHeader: locate · bar · Ask AI, then family chips), so
// Home's never paints over the map (MESITA-1616). It was DiscoverModeNav.

import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";

/** Home's header: the Mesita logo, then the location picker (MESITA-2470),
 *  white on the brand colour (MESITA-2476). */
export function ModeTabs() {
  return (
    <div className="sticky top-0 z-20 shrink-0 bg-[var(--brand-pink-deep)] text-white">
      <div className="flex h-[52px] items-center gap-3 px-4" data-home-header>
        <MesitaLogo className="h-[22px] w-auto shrink-0 text-white" />
        <LocationPicker />
      </div>
    </div>
  );
}
