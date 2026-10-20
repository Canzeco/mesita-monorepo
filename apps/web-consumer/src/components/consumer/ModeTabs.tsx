"use client";

// Home's header is the location and nothing else (Pato, MESITA-2405), drawn
// as one scrolling chip row so it spends less height and shows every
// location at once (MESITA-2452):
//
//   (📍 Current location) (🔖 Home ×) (＋ Add)   ← scrolls (MESITA-2452)
//
// Social and Favorites are rows of the catalog's column (CatalogRails).
// White like the bottom bar, its hairline under it (MESITA-2409). Home draws it
// from app/(shell)/(discovery)/discover/layout.tsx; Search has its own
// header (SearchHeader: locate · bar · Ask AI, then family chips), so
// Home's never paints over the map (MESITA-1616). It was DiscoverModeNav.

import { LocationPicker } from "@/components/consumer/home/LocationPicker";

/** Home's header: the location chip row alone (MESITA-2405, MESITA-2452).
 *  Social and Favorites are rows of the catalog's column. Same strip as
 *  Search's. */
export function ModeTabs() {
  return (
    <div className="border-border bg-card/95 sticky top-0 z-20 shrink-0 border-b backdrop-blur">
      <div data-home-header>
        <LocationPicker />
      </div>
    </div>
  );
}
