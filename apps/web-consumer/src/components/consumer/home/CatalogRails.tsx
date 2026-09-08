"use client";

// FEED — stacked horizontal rails with a filter control above them.
//
// This is Catalog's body at Feed's address (MESITA-1697). The component, the
// mode key, the EF and the admin matrix column all still say catalog; only the
// guest-facing tab is named Feed. Seed rails are occupied Atlas categories,
// generated rails are vibe queries ranked against Mesita embeddings, tiles are
// FavoriteTile. The page must be a flex column so this scroller gets a height.
//
// THE FILTER CUTS ON THE SERVER, and the refetch key is the whole reason this
// works. The fetch used to be keyed on `[supabase]` alone — mount once, never
// again — so mounting a filter control above it would have produced a control
// that visibly did nothing: the rails were already fetched. `deckRequestKey`
// is the identity of "which answer the server would give", so keying the
// effect on it re-asks exactly when the answer would change and never on GPS
// jitter alone.
//
// TWO COUNTS, TWO MEANINGS, AND THEY ARE NOT INTERCHANGEABLE. The trigger
// shows how many FILTERS ARE APPLIED (its own state, legible before the sheet
// opens); the sheet's CTA shows how many PLACES MATCH (the result). Both props
// are called `count` in their respective components, which is exactly why this
// is written down.
//
// THE TRIGGER WEARS SearchFilterRow's CHROME BUT NOT ITS GEOMETRY. Same 44px
// height, border, `shadow-elev`, blur and primary-filled applied state — but
// full width, not `basis-1/3`. That fraction exists to share a row with
// Search's bar, and Feed has no bar. It also sits OUTSIDE the scroller: a
// filter control that scrolls away is unreachable at the moment a guest most
// wants it, which is the same mistake #1572 fixed on the map.

import { useEffect, useMemo, useState } from "react";
import { Compass, SlidersHorizontal } from "lucide-react";
import { apiListCatalog, type CatalogRail, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useUserLocation } from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { FavoriteTile } from "./FavoriteTile";
import { cn, errMsg } from "@/lib/utils";
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
    // Back to the skeleton while a new filter set is in flight — scheduled
    // rather than set in the effect body, which cascades renders.
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
    // `requestKey` IS the dependency — it moves when and only when the
    // server's answer would. `filters`/`coords` are read inside and would
    // re-run this on every GPS tick if listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, requestKey]);

  const placesShown = useMemo(
    () => (rails ?? []).reduce((n, rail) => n + rail.places.length, 0),
    [rails],
  );

  const filterBar = (
    <div className="border-border bg-background/90 shrink-0 border-b px-4 py-2.5 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-label={
          appliedCount > 0 ? `Filters, ${appliedCount} applied` : "Filter places"
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
        <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
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
        categoryOptions={[]}
        // PLACES MATCHING, not filters applied — the other meaning of `count`.
        count={rails === null ? null : placesShown}
        hasLocation={coords !== null}
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
  };

  // The bar and the sheet are OUTSIDE every branch below — a filter control
  // that vanishes on the empty state is missing at the one moment the guest
  // needs it, which is the mistake #1572 fixed on the map's own filter.
  const shell = (body: React.ReactNode) => (
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
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2.5 overflow-hidden">
              {Array.from({ length: 4 }, (_, j) => (
                <Skeleton
                  key={j}
                  // The tile grew to 2:3 with MESITA-1624's 4:3 + 4:3 body,
                  // so a 148px rail card is 222px tall, not the 208px this
                  // used to guess.
                  className="h-[222px] w-[148px] shrink-0 rounded-2xl"
                />
              ))}
            </div>
          </div>
        ))}
      </div>,
    );
  }

  // TWO DIFFERENT FAILURES, TWO DIFFERENT SCREENS. "No places yet" blames the
  // catalog; when a filter is what emptied the rails, saying that is simply
  // wrong — and it hides the one control that would fix it. The guest is told
  // which of the two happened and handed the way out.
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
    </div>,
  );
}
