"use client";

// Places — a Temu-style split under one location bar (Pato, MESITA-2367,
// MESITA-2383).
//
//   Places · Social · Chat                 Home's header (ModeTabs)
//   ┌──────────────────────────────────────┐
//   │ ⌖ Tecnologico                      ⌄ │  the active location, full width;
//   ├────────────────┬─────────────────────┤  a tap opens the location sheet
//   │ ❤️ Favorites    │                     │
//   │▌✨ Featured     │       square        │  left quarter: Favorites, Featured
//   │ ☕ Coffee       │        tile         │  (the default: every place), then
//   │ 🥐 Breakfast    │                     │  one row per family. The chosen
//   │                │                     │  row is white, bold, an ink bar on
//                                            its left edge.
//
// The location sheet lists Current location, the guest's saved locations
// (MESITA-2380) and Add location; picking one reloads the catalog from it.
// Featured mixes Mesita Selected and Google places (they are sources, not
// guest choices); a family row shows that family's rail; Favorites shows the
// guest's saved places in the same tiles (it was Home's fourth tab,
// MESITA-2368). `useUserLocation` asks for location on mount. No search bar.
// The request sends no predicates, so a saved scope can never keep cutting
// this list.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Bookmark,
  ChevronDown,
  Compass,
  Heart,
  MapPin,
  Navigation,
  Plus,
  X,
} from "lucide-react";
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
  readSavedPlacePreviews,
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from "@/lib/saved-places";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { CatalogTile } from "./CatalogTile";
import { AddLocationSheet } from "./AddLocationSheet";
import {
  removeSavedLocation,
  useSavedLocations,
} from "@/lib/saved-locations";
import { cn, errMsg } from "@/lib/utils";
import { placesFeed } from "@/lib/catalog-feed";

/** The server's rail keys for the two sets Featured mixes. */
export const MESITA_RAIL_KEY = "mesita_selected";
export const GOOGLE_RAIL_KEY = "google_places";

/** One square tile per row (MESITA-2367), 6px of room above, left and right
 *  and between tiles — one space size (Pato, MESITA-2370). */
const PLACES_LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";

const ROW_BASE =
  "relative flex w-full items-center gap-1.5 px-3 py-3.5 text-left text-xs leading-tight transition";
const ROW_ON = "bg-card text-foreground font-semibold";
const ROW_OFF = "text-foreground hover:bg-card/60";

/** The column's default row: every place, one list (MESITA-2383; it was All). */
export const FEATURED_CHIP = "featured";
/** The guest's saved places (MESITA-2383; it was Home's Favorites tab). */
export const FAVORITES_CHIP = "favorites";

/** The column: Favorites, Featured, then one row per guest family. Google
 *  Places and Mesita Selected are not guest choices (MESITA-2381): they are
 *  the sources Featured mixes. */
export function placesChips(rails: readonly CatalogRail[]): {
  key: string;
  label: string;
  emoji?: string;
}[] {
  const families = rails.filter(
    (r) => r.key !== MESITA_RAIL_KEY && r.key !== GOOGLE_RAIL_KEY,
  );
  return [
    { key: FAVORITES_CHIP, label: "Favorites", emoji: "❤️" },
    { key: FEATURED_CHIP, label: "Featured", emoji: "✨" },
    ...families.map((r) => ({
      key: r.key,
      label: r.label,
      emoji: r.emoji && r.emoji !== "·" ? r.emoji : undefined,
    })),
  ];
}

/** Featured: Mesita Selected first, then Google places, each place once. The
 *  app merges the two rails until the server ranks one feed (MESITA-2384). */
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

/** Saved places, newest save first, from their stored previews. */
export function favoritePlaces(
  savedIds: ReadonlySet<string>,
  previews: ReadonlyMap<string, Place>,
): Place[] {
  return [...savedIds]
    .reverse()
    .map((id) => previews.get(id))
    .filter((p): p is Place => p != null)
    .map((p) => enrichPlaceOverview(p));
}

type Origin = { key: string; name: string; lat: number; lng: number } | null;

export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const { savedIds, hydrated, setSaved } = useSavedPlaces();
  const openGooglePlace = useOpenGooglePlace();
  const [rails, setRails] = useState<CatalogRail[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // null = the guest's current location; a saved location = search from it.
  const [origin, setOrigin] = useState<Origin>(null);
  const savedLocations = useSavedLocations();
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
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
  const [chip, setChip] = useState<string>(FEATURED_CHIP);
  const locating = useUserLocationLocating();
  const locate = useLocateUser();

  // Saved previews re-read whenever the saved set changes, so a heart
  // tapped on Featured shows up under Favorites at once.
  const favorites = useMemo(
    () => favoritePlaces(savedIds, readSavedPlacePreviews<Place>()),
    [savedIds],
  );

  const toggleSave = (place: Place, saved: boolean) => {
    if (saved) {
      setSaved(place.id, false);
      removeSavedPlacePreview(place.id);
      toast.action("Removed from saved", {
        label: "Undo",
        onClick: () => {
          upsertSavedPlacePreview(place);
          setSaved(place.id, true);
        },
      });
      return;
    }
    upsertSavedPlacePreview(place);
    setSaved(place.id, true);
    trackEvent(supabase, "home_card_save", {
      mode: "places",
      place_id: place.id,
    });
  };

  const locationLabel =
    origin?.name ??
    (coords !== null
      ? "Current location"
      : locating
        ? "Locating…"
        : "Use my location");

  // THE LOCATION BAR (MESITA-2383): one full-width line between Home's
  // header and the split, showing only where Places searches from. Quiet
  // gray, a slightly stronger line under it, no shadow.
  const locationBar = (
    <button
      type="button"
      onClick={() => setPicking(true)}
      aria-haspopup="dialog"
      aria-label={`Location: ${locationLabel}. Change location`}
      className="bg-muted border-foreground/15 text-foreground flex w-full shrink-0 items-center gap-2 border-b px-3 py-2.5 text-left text-sm font-semibold"
      data-places-location-bar
    >
      <MapPin className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{locationLabel}</span>
      <ChevronDown
        className="text-muted-foreground h-4 w-4 shrink-0"
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );

  const sheetRow = (row: {
    key: string;
    label: string;
    icon: ReactNode;
    selected: boolean;
    onClick: () => void;
    muted?: boolean;
    onRemove?: () => void;
  }) => (
    <li key={row.key} className="relative">
      <button
        type="button"
        onClick={row.onClick}
        aria-pressed={row.selected}
        className={cn(
          "flex w-full items-center gap-3 py-3.5 pr-10 text-left text-sm transition",
          row.selected ? "font-semibold" : "hover:bg-muted",
          row.muted && !row.selected && "text-muted-foreground",
        )}
      >
        {row.icon}
        <span className="min-w-0 truncate">{row.label}</span>
      </button>
      {row.onRemove ? (
        <button
          type="button"
          onClick={row.onRemove}
          aria-label={`Remove ${row.label}`}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
          data-places-remove-location
        >
          <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </li>
  );

  const ICON = "h-4 w-4 shrink-0";
  const locationSheet = (
    <LocalSheet open={picking} onClose={() => setPicking(false)} ariaLabel="Location">
      <div className={SHEET_BODY_CLASS} data-places-location-sheet>
        <h2 className={SHEET_TITLE_CLASS}>Location</h2>
        <ul role="list" aria-label="Location" className="divide-border mt-2 divide-y" data-places-location>
          {sheetRow({
            key: "here",
            label:
              coords !== null
                ? "Current location"
                : locating
                  ? "Locating…"
                  : "Use my location",
            icon: <Navigation className={ICON} strokeWidth={2.25} aria-hidden />,
            selected: origin === null && coords !== null,
            muted: coords === null,
            onClick: () => {
              setOrigin(null);
              if (coords === null) locate();
              setPicking(false);
            },
          })}
          {savedLocations.map((l) =>
            sheetRow({
              key: `saved:${l.id}`,
              label: l.name,
              icon: <Bookmark className={ICON} strokeWidth={2.25} aria-hidden />,
              selected: origin?.key === `saved:${l.id}`,
              onClick: () => {
                setOrigin({ key: `saved:${l.id}`, name: l.name, lat: l.lat, lng: l.lng });
                setPicking(false);
              },
              // Removing the active location falls back to Current location.
              onRemove: () => {
                removeSavedLocation(l.id);
                if (origin?.key === `saved:${l.id}`) setOrigin(null);
              },
            }),
          )}
          <li>
            <button
              type="button"
              onClick={() => {
                setPicking(false);
                setAdding(true);
              }}
              className="hover:bg-muted flex w-full items-center gap-3 py-3.5 text-left text-sm transition"
              data-places-add-location
            >
              <Plus className={ICON} strokeWidth={2.25} aria-hidden />
              <span>Add location</span>
            </button>
          </li>
        </ul>
      </div>
    </LocalSheet>
  );

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

  const categories = (
    <nav
      className="bg-muted scrollbar-hide w-1/4 shrink-0 overflow-y-auto overscroll-y-contain"
      aria-label="Places"
      data-places-categories
    >
      <ul role="list" aria-label="Families">{chips.map(categoryRow)}</ul>
    </nav>
  );

  // Header line → location bar → the split; every state draws in the right
  // three quarters, which scrolls on its own.
  const shell = (inner: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      {locationBar}
      <div className="flex min-h-0 flex-1">
        {categories}
        <div className="bg-card scrollbar-hide flex min-h-0 w-3/4 flex-col overflow-y-auto overscroll-y-contain">
          {inner}
        </div>
      </div>
      {locationSheet}
      <AddLocationSheet
        open={adding}
        onClose={() => setAdding(false)}
        here={coords}
        onSaved={(l) =>
          setOrigin({ key: `saved:${l.id}`, name: l.name, lat: l.lat, lng: l.lng })
        }
      />
    </div>
  );

  const tiles = (list: readonly Place[], label: string) => (
    <div className="pb-6">
      <ul role="list" aria-label={label} className={PLACES_LIST}>
        {list.map((place) => {
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
  );

  // Favorites never waits on the catalog: the saves are local.
  if (chip === FAVORITES_CHIP) {
    if (!hydrated) {
      return shell(
        <div className={PLACES_LIST}>
          <Skeleton className="aspect-square rounded-none" />
        </div>,
      );
    }
    return shell(
      favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on a place and it lands here."
        />
      ) : (
        tiles(favorites, "Favorites")
      ),
    );
  }

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
    chip === FEATURED_CHIP
      ? allPlaces(shownRails)
      : (shownRails.find((r) => r.key === chip)?.places ?? []);

  const empty =
    chip === FEATURED_CHIP && from === null ? (
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
        description="Try another family, or another location."
      />
    );

  return shell(
    shown.length === 0
      ? empty
      : tiles(shown, chips.find((c) => c.key === chip)?.label ?? "Places"),
  );
}
