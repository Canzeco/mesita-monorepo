"use client";

import type { Place } from "@/lib/api/places";
import { useUserLocation } from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { FEED_MOCK_PLACES } from "@/lib/mock/feed-places";
import { Skeleton } from "@/components/shared";
import { FavoriteTile } from "./FavoriteTile";

// Feed mode — the shared deck as ONE two-column grid of places, edge to edge
// (Pato, MESITA-1621: "add places as if they were a feed, 2 wide, occupying
// almost 100% of screen").
//
// THIS IS NOT CATALOG. Catalog is rails: category headings with a horizontal
// scroller under each, so a place is seen inside its category and most of
// every rail is off-screen. Feed drops the categories entirely and pours the
// whole deck down one vertical column pair — the deck's ranking IS the order,
// and the screen holds ~4 places at a time instead of ~2.5 plus two clipped
// neighbours. Two browse modes, two different questions: "what kind of place"
// vs "what's next".
//
// NOT SOCIALFEED EITHER. `SocialFeed.tsx` — people, not places — was the
// other candidate for this route and stays parked on disk; the instruction
// named places.
//
// px-2 + gap-2, NOT Favorites' px-4/gap-2.5. The grid spans 359 of the 375px
// frame (~96%) and a tile lands at ~176px against Favorites' ~167px. The
// gutter is what carries "almost 100%" — going to px-0 would bleed the cards
// off both edges, and a 2xl corner radius with no margin beside it reads as a
// clipped render rather than a full-bleed one.
//
// TILES ARE `FavoriteTile`, the same reuse CatalogRails makes. A place tile
// is a photo, a name, a distance, an opening state and a heart on every
// browse surface in this app; a Feed-only card would be a fourth copy of
// that, drifting on its own schedule. The 3:4 ratio comes with it.
//
// NO EMPTY STATE, and no error state either (Pato, MESITA-1621: "use mock
// data for the moment for the feed view"). The catalog is empty in every
// environment right now, so a Feed wired to the deck alone shows nothing but
// "No places yet" and the mode cannot be reviewed at all. When the deck comes
// back empty — or fails — the grid falls to FEED_MOCK_PLACES and SAYS SO in
// a strip above the tiles. Real deck rows always win, and the day the catalog
// fills, Feed shows them with no code change here.
export function PlaceFeed({
  places,
  fetchError = null,
}: {
  places: Place[];
  /** The shared deck fetch failed (HomeDeckBoundary passes it down). */
  fetchError?: string | null;
}) {
  const coords = useUserLocation();
  const { savedIds, hydrated, setSaved } = useSavedPlaces();

  // ALL-REAL OR ALL-MOCK, never a mixture — three live places padded out to
  // eight with invented ones would be indistinguishable on the grid and is
  // the exact thing the notice below could not honestly describe.
  const usingMock = places.length === 0;
  const rows = usingMock ? FEED_MOCK_PLACES : places;

  const toggleSave = (place: Place, saved: boolean) => {
    if (saved) {
      setSaved(place.id, false);
      return;
    }
    upsertSavedPlacePreview(place);
    setSaved(place.id, true);
  };

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-2 pt-2 pb-6">
      {/* The mock must never pass for live data. FavoritesList uses this same
          strip to explain a thinner screen; here it explains a fuller one. */}
      {usingMock && (
        <p className="bg-muted text-muted-foreground mb-2 rounded-lg px-3 py-2 text-xs leading-snug">
          {fetchError
            ? "Tonight's places didn't load — showing sample places for now."
            : "Sample places while the catalog fills up."}
        </p>
      )}

      {/* savedIds is an empty set until localStorage is read (SSR parity), so
          painting hearts before `hydrated` shows every tile as unsaved for a
          frame — the same reason FavoritesList gates on it. The rows are
          already here, so this is a skeleton over the grid, not the screen. */}
      {!hydrated ? (
        <FeedGridSkeleton />
      ) : (
        <ul
          role="list"
          aria-label="Places"
          className="grid grid-cols-2 gap-2"
        >
          {rows.map((place) => {
            const located = withUserDistance(place, coords);
            const saved = savedIds.has(place.id);
            return (
              <FavoriteTile
                key={place.id}
                place={located}
                saved={saved}
                onToggle={() => toggleSave(place, saved)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Four tiles — two full rows at the feed's density, which is what a 375px
// frame shows above the fold. Matches the grid's own gutters so nothing
// shifts when the hearts arrive.
function FeedGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
      ))}
    </div>
  );
}
