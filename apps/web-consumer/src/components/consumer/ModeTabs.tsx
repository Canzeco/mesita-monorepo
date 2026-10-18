"use client";

// Home's header (Pato, MESITA-2405: "The top bar is just to select the
// location. thats it."):
//
//   [⌖ Tecnologico                         ⌄]
//
// Social and Favorites are rows of the catalog's column (CatalogRails).
// White like the bottom bar, its hairline under it (MESITA-2409). Home draws it
// from app/(shell)/(discovery)/discover/layout.tsx; Search has its own
// header (SearchHeader: locate · bar · Ask AI, then family chips), so
// Home's never paints over the map (MESITA-1616). It was DiscoverModeNav.

import { LocationPicker } from "@/components/consumer/home/LocationPicker";

/** Home's header: the location picker alone, full width (Pato, MESITA-2405:
 *  "The top bar is just to select the location. thats it."). Social and
 *  Favorites are rows of the catalog's column now. Same strip as Search's. */
export function ModeTabs() {
  return (
    <div className="border-border bg-card/95 sticky top-0 z-20 shrink-0 border-b backdrop-blur">
      <div className="px-2 py-2.5" data-home-header>
        <LocationPicker />
      </div>
    </div>
  );
}
