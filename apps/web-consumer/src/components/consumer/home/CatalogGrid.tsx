"use client";

// Catalog mode — the full deck as a browsable grid.
//
// The pitch the parked pill made for a month: "every place, browsable and
// filterable, without swiping." So this is Swipe's data with Swipe's verdict
// removed — no cards, no gestures, no seen-set. A place you scrolled past is
// still there when you scroll back, which is the whole difference between
// browsing and deciding.
//
// Reuse, deliberately: the same shared deck from HomeDeckContext (zero extra
// fetches — switching modes never re-runs the recommender) and the same
// FavoriteTile the Favorites grid uses. Catalog adds no data layer of its own.
//
// Ordering: whatever the deck arrived in (HomeDeckBoundary floats partners
// first), or open-first. Explicitly NOT randomness-ordered — that knob exists
// so a swipe deck doesn't feel like the same deck twice, and a catalog you
// can't find a place in again would be broken, not fresh.

import { useMemo, useState } from "react";
import { ArrowUpDown, Compass } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { useUserLocation } from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { FavoriteTile } from "./FavoriteTile";

/** Past this count the grid earns a sort control; below it, it's chrome. */
const SORT_CONTROL_MIN = 4;

type Sort = "suggested" | "open";

export function CatalogGrid({
  places: deckPlaces,
  fetchError = null,
}: {
  places: Place[];
  /** The shared deck fetch failed — there is nothing to browse. */
  fetchError?: string | null;
}) {
  const { savedIds, setSaved } = useSavedPlaces();
  const [sort, setSort] = useState<Sort>("suggested");

  // Distances measure from the device fix; the zone-center option went with
  // the filter surface (MESITA-1183).
  const coords = useUserLocation();
  const center = coords;
  const located = useMemo(
    () => deckPlaces.map((place) => withUserDistance(place, center)),
    [deckPlaces, center],
  );

  const ordered = useMemo(() => {
    if (sort === "suggested") return located;
    // Open first, each group keeping deck order (Array.sort is stable).
    return [...located].sort(
      (a, b) => Number(b.open_now === true) - Number(a.open_now === true),
    );
  }, [located, sort]);

  // Saving from the grid is one tap with no dialog — it's the
  // non-destructive direction. Unsaving here is too: the confirm dialog lives
  // in Favorites, where removing is the destructive act on a curated list.
  // Here the heart is a bookmark toggle over the whole catalog.
  const toggleSave = (place: Place, saved: boolean) => {
    if (saved) {
      setSaved(place.id, false);
      return;
    }
    upsertSavedPlacePreview(place);
    setSaved(place.id, true);
  };

  if (fetchError) {
    return (
      <EmptyState
        icon={Compass}
        title="Couldn't load the catalog"
        description="Tonight's places didn't come back. Pull the tab again in a moment."
        action={{ label: "Try again", href: CONSUMER_ROUTES.homeTabs.catalog }}
      />
    );
  }

  if (deckPlaces.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No places yet"
        description="The catalog is still filling up. Check back soon."
      />
    );
  }

  const openNow = located.filter((p) => p.open_now === true).length;

  return (
    // Header sits OUTSIDE the scroller so the live count stays reachable
    // when the grid is scrolled.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <p
            className="text-muted-foreground text-xs font-semibold"
            aria-live="polite"
          >
            <span className="text-foreground">
              {located.length} {located.length === 1 ? "place" : "places"}
            </span>
            {openNow > 0 && ` · ${openNow} open now`}
          </p>

          <div className="flex shrink-0 items-center gap-1.5">
            {located.length >= SORT_CONTROL_MIN && (
              <button
                type="button"
                onClick={() =>
                  setSort((s) => (s === "suggested" ? "open" : "suggested"))
                }
                className="border-border bg-card text-muted-foreground hover:text-foreground type-label flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sort === "suggested" ? "Suggested" : "Open first"}
              </button>
            )}
          </div>
        </div>
      </div>

      {
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <ul
            role="list"
            aria-label="Catalog"
            className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2"
          >
            {ordered.map((place) => {
              const saved = savedIds.has(place.id);
              return (
                <FavoriteTile
                  key={place.id}
                  place={place}
                  saved={saved}
                  onToggle={() => toggleSave(place, saved)}
                />
              );
            })}
          </ul>
        </div>
      }
    </div>
  );
}
