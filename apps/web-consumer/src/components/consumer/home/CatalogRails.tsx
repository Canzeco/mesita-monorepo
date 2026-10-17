"use client";

// Places — All, then one carousel per guest family. A card is wide
// enough that about 2.5 fit, so the next one peeks and the row reads
// as a scroll. The gap above a row is the family name. An empty
// family is the name only. Favs keeps its own rounded tile.
//
// The catalog is Mesita places only. Filters are the two Mesita rings.
// Family is not a filter. Google Places is not a choice. The review floor
// is the map's. Location, when the browser has it, ranks proximity.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Compass, SlidersHorizontal } from "lucide-react";
import { apiListCatalog, type CatalogRail, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics/track";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { CatalogTile } from "./CatalogTile";
import { cn, errMsg } from "@/lib/utils";
import { placesFeed } from "@/lib/catalog-feed";
import { summarizeCatalog } from "@/lib/catalog-summary";
import {
  resetDiscoveryFilters,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";
import {
  countAppliedDiscoveryFilters,
  hasDiscoveryPredicates,
} from "@/lib/discovery-filters-engine";
import {
  deckRequestKey,
  toDiscoveryPredicatesWire,
} from "@/lib/discovery-filters-wire";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";

export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
  const { savedIds, setSaved } = useSavedPlaces();
  const [rails, setRails] = useState<CatalogRail[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useDiscoveryFilters();
  const appliedCount = countAppliedDiscoveryFilters(filters);
  const filtered = hasDiscoveryPredicates(filters);
  const requestKey = deckRequestKey(filters, coords);

  useEffect(() => {
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setRails(null);
      setFetchError(null);
    });
    (async () => {
      try {
        const next = await apiListCatalog(
          supabase,
          coords,
          filtered ? toDiscoveryPredicatesWire(filters) : undefined,
        );
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
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, requestKey]);

  const summary = useMemo(() => summarizeCatalog(rails ?? []), [rails]);
  const shownRails = useMemo(() => placesFeed(rails ?? []), [rails]);

  const placesShown = summary.total;

  const filterBar = (
    <div className="border-border bg-background/90 shrink-0 border-b px-4 py-2.5 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-label={
          appliedCount > 0
            ? `Filters, ${appliedCount} applied`
            : "Filter places"
        }
        aria-haspopup="dialog"
        aria-pressed={appliedCount > 0}
        className={cn(
          "shadow-elev flex h-11 w-full items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold backdrop-blur-xl transition active:scale-[0.98]",
          appliedCount > 0
            ? "border-primary bg-primary text-primary-foreground shadow-glow"
            : "border-border bg-card/95 text-foreground",
        )}
      >
        <SlidersHorizontal
          className="h-4 w-4 shrink-0"
          strokeWidth={2.25}
          aria-hidden
        />
        <span className="truncate">Filters</span>
        {appliedCount > 0 && (
          <span className="tabular-nums">· {appliedCount}</span>
        )}
      </button>
    </div>
  );

  const filtersSheet = (
    <LocalSheet
      open={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      ariaLabel="Filters"
    >
      <DiscoveryFilters
        onClose={() => setFiltersOpen(false)}
        count={rails === null ? null : placesShown}
        hasLocation={coords !== null}
        locating={locating}
        onLocate={locate}
      />
    </LocalSheet>
  );

  const toggleSave = (place: Place, saved: boolean) => {
    if (saved) {
      setSaved(place.id, false);
      return;
    }
    upsertSavedPlacePreview(place);
    setSaved(place.id, true);
    trackEvent(supabase, "home_card_save", {
      mode: "places",
      place_id: place.id,
    });
  };

  const shell = (body: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      {filterBar}
      {body}
      {filtersSheet}
    </div>
  );

  if (fetchError) {
    return shell(
      <EmptyState
        icon={Compass}
        title="Couldn't load the catalog"
        description="Tonight's places didn't come back. Pull the tab again in a moment."
        action={{ label: "Try again", href: CONSUMER_ROUTES.discoverDefault }}
      />,
    );
  }

  if (rails === null) {
    return shell(
      <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain pt-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i}>
            <Skeleton className="mx-3 mb-2 h-4 w-24 rounded-none" />
            <div className="flex gap-2 overflow-hidden pl-3">
              {Array.from({ length: 3 }, (_, j) => (
                <Skeleton
                  key={j}
                  className="aspect-[3/4] w-[calc((100%-1rem)/2.5)] shrink-0 rounded-none"
                />
              ))}
            </div>
          </div>
        ))}
      </div>,
    );
  }

  if (rails.length === 0) {
    return shell(
      filtered ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No places match these filters"
          description="Nothing in tonight's catalog fits. Widen a filter and the rails come back."
          action={{ label: "Clear filters", onClick: resetDiscoveryFilters }}
        />
      ) : (
        <EmptyState
          icon={Compass}
          title="No places yet"
          description="The catalog is still filling up. Check back soon."
        />
      ),
    );
  }

  return shell(
    <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
      <p className="type-body text-muted-foreground px-3 py-2.5 tabular-nums">
        {summary.total} {summary.total === 1 ? "place" : "places"}
        {summary.openNow > 0 ? ` · ${summary.openNow} open now` : ""}
      </p>
      <div className="flex flex-col gap-4 pb-4">
        {shownRails.map((rail) => (
          <section key={rail.key} aria-labelledby={`${rail.key}-heading`}>
            <h2
              id={`${rail.key}-heading`}
              className="font-display text-foreground px-3 text-sm font-semibold tracking-tight"
            >
              {rail.emoji && rail.emoji !== "·" ? (
                <span className="mr-1.5" aria-hidden>
                  {rail.emoji}
                </span>
              ) : null}
              {rail.label}
            </h2>
            {rail.places.length > 0 ? (
              <ul
                role="list"
                aria-label={rail.label}
                className="scrollbar-hide mt-2 flex gap-2 overflow-x-auto overscroll-x-contain pl-3"
              >
                {rail.places.map((place) => {
                  const located = withUserDistance(place, coords);
                  const saved = savedIds.has(place.id);
                  return (
                    <CatalogTile
                      key={place.id}
                      place={located}
                      saved={saved}
                      onToggle={() => toggleSave(place, saved)}
                      className="w-[calc((100%-1rem)/2.5)] shrink-0"
                    />
                  );
                })}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>,
  );
}
