"use client";

// Home — a Temu-style split (Pato, MESITA-2367) under Home's header.
//
//   [⌖ Tecnologico                       ⌄]   Home's header (ModeTabs) is the
//   ┌────────────────┬─────────────────────┐   location alone (MESITA-2405),
//   │ ⚇ Social        │                     │   written to
//   │ ○ Saved         │       square        │   lib/active-location.ts and
//   │▌⌖ Nearby        │        tile         │   read here.
//   │ ──────────────  │                     │
//   │ ○ Coffee     ↕  │                     │
//
// Every row's mark is a monochrome line icon (lib/family-icons.tsx), never
// an emoji (Pato, MESITA-2478: "emojis uses color and that takes
// attention"); the chosen row's stroke is heavier, like BottomNav's.
//
// Social DRAWS IN THE RIGHT PANE (Pato, MESITA-2474: "social must be on the
// same feed. don't change page"): the row is chosen like Saved and the
// activity list (SocialFeed) fills the right three quarters. It opened its own
// page, /discover/social, from MESITA-2442 until then.
//
// Left quarter (Pato, MESITA-2411): Social, Saved, Nearby and Popular
// (the default: every place) PINNED above a rule; under it one row per
// family, and only that list scrolls. The chosen row is white, bold, an ink bar on its left edge.
// Nearby and Popular are the server's ONE ranked Area pool (MESITA-2379/2384):
// Google and Mesita places merged, scored and ranked there; this screen
// pages it (20 tiles at a time, more on scroll). A family row ASKS ITS OWN
// QUESTION (MESITA-2438): it sends the family's key, so Google gets that
// family's full type list and the server lists its primary places before
// its secondary ones. Each location × row's pool is kept ten minutes
// (lib/area-pool-cache.ts), so going back to a row spends nothing. Saved
// shows the guest's saved places in the same tiles (it was Home's fourth
// tab, MESITA-2368). Under each tile, TEMPORARILY, the server's score
// breakdown (AreaDiagnostics.tsx). `useUserLocation` asks for location on mount. No search bar.
// The request sends no predicates, so a saved scope can never keep cutting
// this list.

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Compass, Heart, MapPin } from "lucide-react";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import {
  apiListAreaPool,
  type AreaPool,
  type CatalogRail,
  type Place,
  type AreaPrefer,
} from "@/lib/api/places";
import {
  areaPoolKey,
  clearAreaPools,
  readAreaPool,
  writeAreaPool,
} from "@/lib/area-pool-cache";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { FamilyIcon } from "@/lib/family-icons";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics/track";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationError,
  useUserLocationSettled,
  type LocationError,
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
import { CatalogTile } from "./CatalogTile";
import { useActiveLocation } from "@/lib/active-location";
import { cn, errMsg } from "@/lib/utils";
import { placesFeed } from "@/lib/catalog-feed";
import { AreaDiagnostics } from "./AreaDiagnostics";
import { SocialFeed } from "./SocialFeed";

/** The server's rail keys for the two sources the All row mixes. */
export const MESITA_RAIL_KEY = "mesita_selected";
export const GOOGLE_RAIL_KEY = "google_places";

/** One square tile per row (MESITA-2367), 6px of room above, left and right
 *  and between tiles — one space size (Pato, MESITA-2370). */
const PLACES_LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";

const ROW_BASE =
  "relative flex w-full items-center gap-1.5 px-3 py-3.5 text-left text-xs leading-tight transition";
const ROW_ON = "bg-card text-foreground font-semibold";
const ROW_OFF = "text-foreground hover:bg-card/60";

/** The column's default row: every place, one list (MESITA-2383, MESITA-2416). */
/** Every family, ranked Near: the operator's Proximity/Popularity balance
 *  (MESITA-2426; Near and Popular replaced All). */
export const NEAR_CHIP = "near";
/** Every family, ranked on Popularity alone inside the same radius. */
export const POPULAR_CHIP = "popular";

/** Near and Popular are every family; any other row is one family. */
export function isEveryFamily(chip: string): boolean {
  return chip === NEAR_CHIP || chip === POPULAR_CHIP;
}

/** What the row asks the server to rank by (MESITA-2428): Nearby,
 *  Popular, or a family row's Family mode. */
export function chipPrefer(chip: string): AreaPrefer {
  return chip === POPULAR_CHIP
    ? "popular"
    : chip === NEAR_CHIP
      ? "near"
      : "family";
}
/** The guest's saved places (MESITA-2383; Home's Favorites tab, then row, Saved since MESITA-2427). */
export const SAVED_CHIP = "saved";
/** Social — a row since MESITA-2405 (it was a Home pill); its feed draws in
 *  the right pane (MESITA-2474). */
export const SOCIAL_CHIP = "social";

/** The column: Social · Saved · Nearby · Popular, a rule, then every
 *  guest family (MESITA-2383, MESITA-2384, MESITA-2411, MESITA-2426).
 *  Everything through POPULAR_CHIP is pinned; the families after it scroll.
 *  Google Places and Mesita Selected are not guest choices (MESITA-2381):
 *  they are the sources Near and Popular mix. A family with
 *  nothing here says so rather than hiding. */
export function placesChips(): { key: string; label: string }[] {
  return [
    // Social's feed draws in the right pane (MESITA-2474); no "Soon" tag
    // ever (Pato, MESITA-2418: the tag "looks like shit").
    { key: SOCIAL_CHIP, label: "Social" },
    // Saved, not Favorites, and Nearby, not Near (Pato, MESITA-2427); the
    // heart stays, matching the tile's save button (MESITA-2430):
    // beside Nearby and Popular, "Favorites" read as Mesita's picks.
    { key: SAVED_CHIP, label: "Saved" },
    { key: NEAR_CHIP, label: "Nearby" },
    { key: POPULAR_CHIP, label: "Popular" },
    ...FILTERABLE_PLACE_FAMILIES.map((f) => ({
      key: f.key as string,
      label: f.label,
    })),
  ];
}

/** Social, Saved, Nearby, Popular: the pinned head of the column
 *  (MESITA-2411, MESITA-2426). */
export const PINNED_CHIPS = 4;

/** Tiles drawn per page; the next page appends on scroll (MESITA-2384). */
export const PLACES_PAGE = 20;

/** The families a row asks the server for (MESITA-2438): its own key, or
 *  none for Nearby and Popular (every family). */
export function chipFamilies(chip: string): string[] {
  return isEveryFamily(chip) ? [] : [chip];
}

/** The places a row shows from the pool, in the server's order. A family
 *  row's pool is already that family's (MESITA-2438); the filter stays as a
 *  guard for an Edge Function that predates it. A legacy rails answer (an
 *  Edge Function from before MESITA-2379) is read the way it always was. */
export function poolPlaces(pool: AreaPool, chip: string): Place[] {
  if (pool.shape === "unified") {
    return isEveryFamily(chip)
      ? pool.places
      : pool.places.filter((p) => p.area?.familyKeys.includes(chip));
  }
  const rails = placesFeed(pool.rails);
  return isEveryFamily(chip)
    ? allPlaces(rails)
    : (rails.find((r) => r.key === chip)?.places ?? []);
}

let legacyShapeLogged = false;

/** Legacy rails only: Mesita Selected first, then Google places, each once. */
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
export function savedPlaceList(
  savedIds: ReadonlySet<string>,
  previews: ReadonlyMap<string, Place>,
): Place[] {
  return [...savedIds]
    .reverse()
    .map((id) => previews.get(id))
    .filter((p): p is Place => p != null)
    .map((p) => enrichPlaceOverview(p));
}

/** NO LOCATION IS NOT A DEAD END (Pato, MESITA-2472: the full-pane "Couldn't
 *  find you" with a paragraph of instructions "looks like … shit"). With no
 *  fix and no saved location, every row ranks around the city's centre, the
 *  Search map's own fallback, and one slim bar above the tiles says so. The
 *  last ask's failure only picks the bar's words. */
export const CITY_FALLBACK = {
  name: "Monterrey",
  ...MONTERREY_CENTER,
} as const;

export function cityFallbackBar(error: LocationError | null): string {
  return error === null
    ? `Showing ${CITY_FALLBACK.name}`
    : `Location is off · Showing ${CITY_FALLBACK.name}`;
}

export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const { savedIds, hydrated, setSaved } = useSavedPlaces();
  const openGooglePlace = useOpenGooglePlace();
  const [pool, setPool] = useState<AreaPool | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // null = the guest's current location; a saved location = search from it.
  const origin = useActiveLocation();
  const locationSettled = useUserLocationSettled();
  const locationError = useUserLocationError();
  // No fix and no saved location, once the browser has answered: the city's
  // centre (MESITA-2472). Before it answers: nothing yet (a skeleton).
  const onCityFallback = origin === null && coords === null && locationSettled;
  const from = origin ?? coords ?? (onCityFallback ? MONTERREY_CENTER : null);
  const waitingForFix = origin === null && coords === null && !locationSettled;
  // Near/Popular (MESITA-2425) is part of the question, so part of the key;
  // the row picks it (MESITA-2426), and every family row asks Family
  // (MESITA-2428). Social and Saved read no pool, so they keep the last
  // pool row's prefer and never spend a request.
  const [chip, setChip] = useState<string>(NEAR_CHIP);
  const [prefer, setPrefer] = useState<AreaPrefer>("near");
  // The family the pool was asked for (MESITA-2438): a family row's own,
  // none for Nearby and Popular.
  const [families, setFamilies] = useState<string[]>([]);
  const requestKey = `${areaPoolKey(from)}|${prefer}${
    families.length > 0 ? `:${families.join(",")}` : ""
  }`;
  // The running load's background reload: the rails on screen stay until
  // the new ones land, and an error never replaces a good feed.
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
    // Until the browser answers there is no point to rank from yet.
    if (waitingForFix) return;
    let cancelled = false;
    // The newest request wins; an older response is dropped.
    let seq = 0;
    // A pool kept from the last ten minutes paints at once: no request.
    const kept = readAreaPool(requestKey);
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setPool(kept);
      setFetchError(null);
    });
    const fetchPool = async (mode: "fresh" | "keep") => {
      const mine = ++seq;
      try {
        const next = await apiListAreaPool(supabase, from, prefer, families);
        if (cancelled || mine !== seq) return;
        if (next.shape === "legacy" && !legacyShapeLogged) {
          legacyShapeLogged = true;
          console.warn(
            "[places] catalog_shape_legacy: the Feed EF answered rails",
          );
        }
        writeAreaPool(requestKey, next);
        setPool(next);
        setFetchError(null);
      } catch (err) {
        if (cancelled || mine !== seq || mode === "keep") return;
        setFetchError(errMsg(err, "Couldn't load the catalog"));
        setPool({ shape: "unified", kind: "none", places: [] });
      }
    };
    reload.current = () => void fetchPool("keep");
    if (!kept) void fetchPool("fresh");
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
  // card comes back with its photo and its link, never the icon stub
  // (MESITA-2307).
  useEffect(
    () =>
      onPlaceCreated(() => {
        clearAreaPools();
        reload.current();
      }),
    [],
  );

  // Paging after ranking: the pool is whole; the screen draws it a page at
  // a time and the sentinel under the last tile asks for the next.
  const [pages, setPages] = useState({ key: "", n: 1 });
  const pageKey = `${requestKey}|${chip}`;
  const pageCount = pages.key === pageKey ? pages.n : 1;
  const sentinel = useRef<HTMLLIElement | null>(null);
  const shown: Place[] = useMemo(
    () => (pool ? poolPlaces(pool, chip) : []),
    [pool, chip],
  );
  const hasMore = shown.length > pageCount * PLACES_PAGE;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setPages((p) => ({
          key: pageKey,
          n: (p.key === pageKey ? p.n : 1) + 1,
        }));
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, pageKey, pageCount]);
  const locate = useLocateUser();

  // Saved previews re-read whenever the saved set changes, so a heart
  // tapped anywhere shows up under Saved at once.
  const savedList = useMemo(
    () => savedPlaceList(savedIds, readSavedPlacePreviews<Place>()),
    [savedIds],
  );

  /** What the events say about a tile: its source, rank and final score. */
  const tileFacts = (place: Place, rank: number) => ({
    source: place.area?.source ?? (place.googleOnly ? "google" : "mesita"),
    rank,
    final: place.area?.final ?? null,
  });

  const toggleSave = (place: Place, saved: boolean, rank = 0) => {
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
      ...tileFacts(place, rank),
    });
  };

  // Every row reads the same: line icon + label (the icon was an emoji until
  // MESITA-2478). Social wore a muted label and a "Soon" tag (MESITA-2408)
  // until Pato cut it (MESITA-2418).
  const categoryRow = (c: { key: string; label: string }) => (
    <li key={c.key}>
      <button
        type="button"
        onClick={() => {
          // The in-Home switch (`nav_tab_tap` is BottomNav's): since
          // MESITA-2409 Home's modes are this column's rows.
          if (chip !== c.key)
            trackEvent(supabase, "home_mode_view", { mode: c.label });
          setChip(c.key);
          if (c.key !== SOCIAL_CHIP && c.key !== SAVED_CHIP) {
            setPrefer(chipPrefer(c.key));
            setFamilies(chipFamilies(c.key));
          }
        }}
        aria-pressed={chip === c.key}
        className={cn(ROW_BASE, chip === c.key ? ROW_ON : ROW_OFF)}
      >
        {chip === c.key ? (
          <span
            className="bg-foreground absolute inset-y-0 left-0 w-[3px]"
            aria-hidden
          />
        ) : null}
        {/* A line icon, never an emoji (MESITA-2478): 1.75 stroke, 2.25
            when chosen, BottomNav's pair. */}
        <FamilyIcon
          name={c.key}
          className="h-4 w-4 shrink-0"
          strokeWidth={chip === c.key ? 2.25 : 1.75}
        />
        <span className="min-w-0 break-words">{c.label}</span>
      </button>
    </li>
  );
  const chips = placesChips();

  const categories = (
    <nav
      className="bg-muted flex w-1/4 shrink-0 flex-col"
      aria-label="Places"
      data-places-categories
    >
      {/* Pinned: Social, then Saved · Nearby · Popular, never scroll
          (MESITA-2411). */}
      <ul
        role="list"
        aria-label="Social"
        className="shrink-0"
        data-places-pinned
      >
        {chips.slice(0, 1).map(categoryRow)}
      </ul>
      {/* Two rules (Pato, MESITA-2426): Social │ Saved · Nearby ·
          Popular │ the families. 30% ink, not 15% (Pato, MESITA-2481:
          "a bit darker"). */}
      <div
        role="separator"
        aria-hidden
        className="border-foreground/30 mx-3 my-1 shrink-0 border-t"
        data-places-rule
      />
      <ul
        role="list"
        aria-label="Yours"
        className="shrink-0"
        data-places-pinned
      >
        {chips.slice(1, PINNED_CHIPS).map(categoryRow)}
      </ul>
      <div
        role="separator"
        aria-hidden
        className="border-foreground/30 mx-3 my-1 shrink-0 border-t"
        data-places-rule
      />
      <ul
        role="list"
        aria-label="Families"
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        data-places-families
      >
        {chips.slice(PINNED_CHIPS).map(categoryRow)}
      </ul>
    </nav>
  );

  // Home's header (the location alone, MESITA-2405) → the split;
  // every state draws in the right three quarters, which scrolls on its own.
  const shell = (inner: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {categories}
        <div className="bg-card scrollbar-hide flex min-h-0 w-3/4 flex-col overflow-y-auto overscroll-y-contain">
          {inner}
        </div>
      </div>
    </div>
  );

  const tiles = (list: readonly Place[], label: string, paged: boolean) => {
    const page = paged ? list.slice(0, pageCount * PLACES_PAGE) : list;
    return (
      <div className="pb-6">
        <ul role="list" aria-label={label} className={PLACES_LIST}>
          {page.map((place, i) => {
            const located = withUserDistance(place, coords);
            const saved = savedIds.has(place.id);
            return (
              <Fragment key={place.id}>
                <CatalogTile
                  place={located}
                  saved={saved}
                  onToggle={() => toggleSave(place, saved, i + 1)}
                  onOpen={() =>
                    trackEvent(supabase, "home_card_open", {
                      mode: "places",
                      place_id: place.id,
                      ...tileFacts(place, i + 1),
                    })
                  }
                  onOpenGoogle={() => openGooglePlace(place)}
                />
                {place.area ? <AreaDiagnostics area={place.area} /> : null}
              </Fragment>
            );
          })}
          {paged && page.length < list.length ? (
            <li ref={sentinel} aria-hidden className="h-px" data-places-more />
          ) : null}
        </ul>
      </div>
    );
  };

  // Social reads its own feed, never the catalog (MESITA-2474).
  if (chip === SOCIAL_CHIP) return shell(<SocialFeed />);

  // Saved never waits on the catalog: the saves are local.
  if (chip === SAVED_CHIP) {
    if (!hydrated) {
      return shell(
        <div className={PLACES_LIST}>
          <Skeleton className="aspect-square rounded-2xl" />
        </div>,
      );
    }
    return shell(
      savedList.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on a place and it lands here."
        />
      ) : (
        tiles(savedList, "Saved", false)
      ),
    );
  }

  // One slim line above the tiles, never a full-pane state (MESITA-2472).
  const cityBar = onCityFallback ? (
    <div
      className="text-muted-foreground flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-xs"
      data-places-city-fallback
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="min-w-0 truncate">{cityFallbackBar(locationError)}</span>
      <button
        type="button"
        onClick={locate}
        className="text-foreground ml-auto shrink-0 font-semibold underline-offset-2 hover:underline"
      >
        Use my location
      </button>
    </div>
  ) : null;

  if (waitingForFix) {
    return shell(
      <div className={PLACES_LIST} data-places-locating>
        <Skeleton className="aspect-square rounded-2xl" />
      </div>,
    );
  }

  if (fetchError) {
    return shell(
      <EmptyState
        icon={Compass}
        title="Couldn't load the catalog"
        description="Tonight's places didn't come back. Pull the tab again in a moment."
        action={{ label: "Try again", href: CONSUMER_ROUTES.home }}
      />,
    );
  }

  if (pool === null) {
    return shell(
      <div className={PLACES_LIST}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>,
    );
  }

  const label = chips.find((c) => c.key === chip)?.label ?? "Places";
  const empty = isEveryFamily(chip) ? (
    <EmptyState
      icon={Compass}
      title="No places here yet"
      description="Try another location, or check back soon."
    />
  ) : (
    <EmptyState
      icon={Compass}
      title={`Nothing in ${label} here yet`}
      description="Try another family, or another location."
    />
  );

  return shell(
    <>
      {cityBar}
      {shown.length === 0 ? empty : tiles(shown, label, true)}
    </>,
  );
}
