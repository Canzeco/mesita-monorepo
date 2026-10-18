"use client";

// Places — a Temu-style split (Pato, MESITA-2367).
//
//   ┌────────────────┬────────────────────┐
//   │ ➤ Current loc. │                    │   left third, two groups:
//   │▌⌖ Tecnologico  │       square       │   WHERE — current location, the
//   │ ⌖ Del Valle    │        tile        │   nearby zones (MESITA-2378), and
//   │ + Add location │                    │   Add location at the bottom;
//   │ ────────────── ├────────────────────┤   then WHAT — All and the
//   │▌🍽️ All          │       square       │   families (MESITA-2381). The
//   │ ☕ Coffee       │        tile        │   chosen row is white, bold, an
//   │ 🥐 Breakfast    │                    │   ink bar on its left edge.
//
// Picking a zone reloads the catalog from that zone's centre. All mixes
// Mesita Selected and Google places (they are sources, no longer guest
// choices); a family row shows that family's rail. Favorites is its own Home
// tab (MESITA-2368). `useUserLocation` also asks for location on mount. No
// search bar. The request sends no predicates, so a saved scope can never
// keep cutting this list.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Compass, MapPin, Navigation, Plus } from "lucide-react";
import { apiListCatalog, type CatalogRail, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics/track";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { onPlaceCreated } from "@/lib/place-created-event";
import { useOpenGooglePlace } from "@/lib/use-open-google-place";
import {
  upsertSavedPlacePreview,
  useSavedPlaces,
} from "@/lib/saved-places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { CatalogTile } from "./CatalogTile";
import { cn, errMsg, haversineKm } from "@/lib/utils";
import { placesFeed } from "@/lib/catalog-feed";

/** The server's rail keys for the two sets that lead the chip row. */
export const MESITA_RAIL_KEY = "mesita_selected";
export const GOOGLE_RAIL_KEY = "google_places";

/** One square tile per row (MESITA-2367), 6px of room above, left and right
 *  and between tiles — one space size (Pato, MESITA-2370). */
const PLACES_LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";

const ROW_BASE =
  "relative flex w-full items-center gap-1.5 px-3 py-3.5 text-left text-xs leading-tight transition";
const ROW_ON = "bg-card text-foreground font-semibold";
const ROW_OFF = "text-foreground hover:bg-card/60";

/** The families group's default row: every place, one list (MESITA-2381). */
export const ALL_CHIP = "all";

/** The families group: All, then one row per guest family. Google Places
 *  and Mesita Selected are no longer guest choices (Pato, MESITA-2381):
 *  they are the sources All mixes. */
export function placesChips(rails: readonly CatalogRail[]): {
  key: string;
  label: string;
  emoji?: string;
}[] {
  const families = rails.filter(
    (r) => r.key !== MESITA_RAIL_KEY && r.key !== GOOGLE_RAIL_KEY,
  );
  return [
    { key: ALL_CHIP, label: "All", emoji: "🍽️" },
    ...families.map((r) => ({
      key: r.key,
      label: r.label,
      emoji: r.emoji && r.emoji !== "·" ? r.emoji : undefined,
    })),
  ];
}

/** All: Mesita Selected first, then Google places, each place once. The app
 *  merges the two rails until the server ranks one feed (MESITA-2379). */
export function allPlaces(rails: readonly CatalogRail[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const key of [MESITA_RAIL_KEY, GOOGLE_RAIL_KEY]) {
    for (const p of rails.find((r) => r.key === key)?.places ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/** A zone the guest can search from: the mean position of the loaded
 *  places that carry it (MESITA-2378). */
export type PlacesZone = { name: string; lat: number; lng: number; count: number };

/** Up to `n` zones from the loaded places — nearest to the guest first, or
 *  the busiest first without a location. Each place counts once. */
export function nearbyZones(
  rails: readonly CatalogRail[],
  here: { lat: number; lng: number } | null,
  n = 3,
): PlacesZone[] {
  const seen = new Set<string>();
  const acc = new Map<string, { name: string; lat: number; lng: number; count: number }>();
  for (const rail of rails) {
    for (const p of rail.places) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const name = p.zone?.trim();
      if (!name || typeof p.lat !== "number" || typeof p.lng !== "number") continue;
      const key = name.toLowerCase();
      const z = acc.get(key) ?? { name, lat: 0, lng: 0, count: 0 };
      z.lat += p.lat;
      z.lng += p.lng;
      z.count += 1;
      acc.set(key, z);
    }
  }
  const zones = [...acc.values()].map((z) => ({
    name: z.name,
    lat: z.lat / z.count,
    lng: z.lng / z.count,
    count: z.count,
  }));
  zones.sort((a, b) =>
    here
      ? haversineKm(here.lat, here.lng, a.lat, a.lng) -
        haversineKm(here.lat, here.lng, b.lat, b.lng)
      : b.count - a.count || a.name.localeCompare(b.name),
  );
  return zones.slice(0, n);
}

export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const { savedIds, setSaved } = useSavedPlaces();
  const openGooglePlace = useOpenGooglePlace();
  const [rails, setRails] = useState<CatalogRail[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Location first, then category (Pato, MESITA-2378): null = the guest's
  // current location; a zone = search from that zone's centre.
  const [origin, setOrigin] = useState<PlacesZone | null>(null);
  // The zone list is taken from current-location loads only, so picking a
  // zone never reshuffles the list under the guest's finger.
  const [zones, setZones] = useState<PlacesZone[]>([]);
  const from = origin ?? coords;
  const requestKey =
    from === null ? "" : `${from.lat.toFixed(3)},${from.lng.toFixed(3)}`;
  // The running load's background reload: the rails on screen stay until
  // the new ones land, and an error never replaces a good feed.
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    // The newest request wins; an older response is dropped.
    let seq = 0;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setRails(null);
      setFetchError(null);
    });
    const fetchRails = async (mode: "fresh" | "keep") => {
      const mine = ++seq;
      try {
        const next = await apiListCatalog(supabase, from);
        if (cancelled || mine !== seq) return;
        setRails(next);
        if (origin === null) setZones(nearbyZones(next, coords));
        setFetchError(null);
      } catch (err) {
        if (cancelled || mine !== seq || mode === "keep") return;
        setFetchError(errMsg(err, "Couldn't load the catalog"));
        setRails([]);
      }
    };
    reload.current = () => void fetchRails("keep");
    void fetchRails("fresh");
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      reload.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, requestKey]);

  // A Google-only card the guest opened is a Mesita place once the create
  // lands (PendingPlaceScreen says so). This Feed sits under the place
  // modal and nothing else refetches it: reload behind the modal and the
  // card comes back with its photo and its link, never the emoji stub
  // (MESITA-2307).
  useEffect(() => onPlaceCreated(() => reload.current()), []);

  const shownRails = useMemo(() => placesFeed(rails ?? []), [rails]);
  const [chip, setChip] = useState<string>(ALL_CHIP);
  const locating = useUserLocationLocating();
  const locate = useLocateUser();

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

  const categoryRow = (c: { key: string; label: string; emoji?: string }) => (
    <li key={c.key}>
      <button
        type="button"
        onClick={() => setChip(c.key)}
        aria-pressed={chip === c.key}
        className={cn(ROW_BASE, chip === c.key ? ROW_ON : ROW_OFF)}
      >
        {chip === c.key ? (
          <span
            className="bg-foreground absolute inset-y-0 left-0 w-[3px]"
            aria-hidden
          />
        ) : null}
        {c.emoji ? (
          <span className="shrink-0" aria-hidden>
            {c.emoji}
          </span>
        ) : null}
        <span className="min-w-0 break-words">{c.label}</span>
      </button>
    </li>
  );
  const chips = placesChips(shownRails);
  const pickRow = (row: {
    key: string;
    label: string;
    icon: ReactNode;
    selected: boolean;
    onClick: () => void;
    muted?: boolean;
  }) => (
    <li key={row.key}>
      <button
        type="button"
        onClick={row.onClick}
        aria-pressed={row.selected}
        className={cn(
          ROW_BASE,
          row.selected ? ROW_ON : ROW_OFF,
          row.muted && !row.selected && "text-muted-foreground",
        )}
      >
        {row.selected ? (
          <span
            className="bg-foreground absolute inset-y-0 left-0 w-[3px]"
            aria-hidden
          />
        ) : null}
        {row.icon}
        <span className="min-w-0 break-words">{row.label}</span>
      </button>
    </li>
  );

  // Two single-select groups, a hairline between (Pato, MESITA-2378):
  // where to search from, then what to show.
  const categories = (
    <nav
      className="bg-muted scrollbar-hide w-1/3 shrink-0 overflow-y-auto overscroll-y-contain"
      aria-label="Places"
      data-places-categories
    >
      <ul role="list" aria-label="Location" data-places-location>
        {pickRow({
          key: "here",
          label:
            coords !== null
              ? "Current location"
              : locating
                ? "Locating…"
                : "Use my location",
          icon: (
            <Navigation className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          ),
          selected: origin === null && coords !== null,
          muted: coords === null,
          onClick: () => {
            setOrigin(null);
            if (coords === null) locate();
          },
        })}
        {zones.map((z) =>
          pickRow({
            key: `zone:${z.name}`,
            label: z.name,
            icon: <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />,
            selected: origin?.name === z.name,
            onClick: () => setOrigin(z),
          }),
        )}
        {/* Add location, at the bottom (Pato, MESITA-2381). Saved areas are
            their own issue (MESITA-2380); until then the row wears Soon. */}
        <li>
          <button
            type="button"
            disabled
            className={cn(ROW_BASE, "text-muted-foreground")}
            data-places-add-location
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="min-w-0 break-words">Add location</span>
            <span className="bg-card text-muted-foreground type-meta ml-auto shrink-0 rounded-full px-1.5 leading-4 font-semibold">
              Soon
            </span>
          </button>
        </li>
      </ul>
      <div className="border-border mx-3 border-t" aria-hidden />
      <ul role="list" aria-label="Families">{chips.map(categoryRow)}</ul>
    </nav>
  );

  // The right two thirds scrolls on its own; every state draws inside it.
  const shell = (inner: ReactNode) => (
    <div className="flex min-h-0 flex-1">
      {categories}
      <div className="bg-card scrollbar-hide flex min-h-0 w-2/3 flex-col overflow-y-auto overscroll-y-contain">
        {inner}
      </div>
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
      <div className={PLACES_LIST}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none" />
        ))}
      </div>,
    );
  }

  if (rails.length === 0) {
    return shell(
      <EmptyState
        icon={Compass}
        title="No places yet"
        description="The catalog is still filling up. Check back soon."
      />,
    );
  }

  const shown: Place[] =
    chip === ALL_CHIP
      ? allPlaces(shownRails)
      : (shownRails.find((r) => r.key === chip)?.places ?? []);

  const empty =
    chip === ALL_CHIP && coords === null ? (
      <EmptyState
        icon={Navigation}
        title="Turn on location"
        description="Places near you show up once Mesita knows where you are."
        action={{ label: "Use my location", onClick: locate }}
      />
    ) : (
      <EmptyState
        icon={Compass}
        title="No places here yet"
        description="Try another chip, or check back soon."
      />
    );

  return shell(
    shown.length === 0 ? (
      empty
    ) : (
      <div className="pb-6">
        <ul role="list" aria-label={chips.find((c) => c.key === chip)?.label} className={PLACES_LIST}>
          {shown.map((place) => {
            const located = withUserDistance(place, coords);
            const saved = savedIds.has(place.id);
            return (
              <CatalogTile
                key={place.id}
                place={located}
                saved={saved}
                onToggle={() => toggleSave(place, saved)}
                onOpenGoogle={() => openGooglePlace(place)}
              />
            );
          })}
        </ul>
      </div>
    ),
  );
}
