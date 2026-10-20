"use client";

// Home's header (Pato, MESITA-2470: "where is the mesita logo in the main
// page … just in the header to give them brand identity"):
//
//   [🔥 mesita.]                         ( 📍 Tecnologico ⌄ )
//
// The Mesita lockup on the left, the location oval on the right (MESITA-2405
// made the location the header's only control; MESITA-2459 made it an oval).
// Social and Favorites are rows of the catalog's column (CatalogRails).
// White like the bottom bar, its hairline under it (MESITA-2409). Home draws it
// from app/(shell)/(discovery)/discover/layout.tsx; Search has its own
// header (SearchHeader: locate · bar · Ask AI, then family chips), so
// Home's never paints over the map (MESITA-1616). It was DiscoverModeNav.

import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";

/** Home's header: the Mesita logo, then the location picker (MESITA-2470).
 *  Ink, not pink: the consumer app is achromatic. Same strip as Search's. */
export function ModeTabs() {
  return (
    <div className="border-border bg-card/95 sticky top-0 z-20 shrink-0 border-b backdrop-blur">
      <div className="flex items-center gap-3 px-3 py-1.5" data-home-header>
        <MesitaLogo className="text-foreground h-7 w-auto shrink-0" />
        <LocationPicker />
      </div>
    </div>
  );
}
