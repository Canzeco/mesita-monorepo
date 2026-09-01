"use client";

// Home Catalog — stacked horizontal rails. Seed rails are occupied Atlas
// categories; generated rails are vibe queries ranked against Mesita
// embeddings. Tiles reuse FavoriteTile. Not the swipe deck. The page
// must be a flex column so this scroller gets a height.

import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { apiListCatalog, type CatalogRail, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useUserLocation } from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { FavoriteTile } from "./FavoriteTile";
import { errMsg } from "@/lib/utils";

export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const { savedIds, setSaved } = useSavedPlaces();
  const [rails, setRails] = useState<CatalogRail[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await apiListCatalog(supabase);
        if (cancelled) return;
        setRails(next);
      } catch (err) {
        if (cancelled) return;
        setFetchError(errMsg(err, "Couldn't load the catalog"));
        setRails([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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
        action={{ label: "Try again", href: CONSUMER_ROUTES.search }}
      />
    );
  }

  if (rails === null) {
    return (
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2.5 overflow-hidden">
              {Array.from({ length: 4 }, (_, j) => (
                <Skeleton
                  key={j}
                  className="h-52 w-[148px] shrink-0 rounded-2xl"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rails.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No places yet"
        description="The catalog is still filling up. Check back soon."
      />
    );
  }

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pt-4 pb-6">
      <div className="flex flex-col gap-8">
        {rails.map((rail) => (
          <section key={rail.key} aria-labelledby={`${rail.key}-heading`}>
            <h2
              id={`${rail.key}-heading`}
              className="font-display text-foreground px-1 text-base font-semibold tracking-tight"
            >
              {rail.label}
            </h2>
            <ul
              role="list"
              aria-label={rail.label}
              className="scrollbar-hide -mx-4 mt-3 flex flex-nowrap gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-1"
            >
              {rail.places.map((place) => {
                const located = withUserDistance(place, coords);
                const saved = savedIds.has(place.id);
                return (
                  <FavoriteTile
                    key={place.id}
                    place={located}
                    saved={saved}
                    onToggle={() => toggleSave(place, saved)}
                    className="w-[148px] shrink-0"
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
