"use client";

// Home — two tabs under Home's header (Pato, MESITA-2517: "header (Mesita
// location as it is) then another header (Places. Social) … If places, show
// the horizontal catalog, is social, show the social feed. easy peasy").
//
//   Mesita            [⌖ Tecnologico ⌄]   Home's header (ModeTabs): the
//   ─────────────────────────────────────  location alone (MESITA-2405),
//        Places       │      Social         written to lib/active-location.ts
//   ━━━━━━━━━━━━━━━━━                       and read here.
//   ┌──────────┬──────────────────────┐
//   │▌▦ All    │                      │
//   │ ○ Coffee │     square tile      │
//   │ ○ …   ↕  │                      │
//
// Places: the left family column beside the tiles (Pato, MESITA-2519: "keep
// the later view of the failies. its fastwer to browse") — Top first,
// then every family, scrolling on its own, no colour stripes (MESITA-2521:
// "we don't need to colors now"). Favorites left the column for the bar's
// Saved tab (Pato, MESITA-2522: "remove favorites from this lateral menu"); MESITA-2517 tried a
// horizontal chip row and Pato sent it back. Social: the activity feed
// (SocialFeed), full width. Every row's mark is a monochrome line icon
// (lib/family-icons.tsx), never an emoji (Pato, MESITA-2478: "emojis uses
// color and that takes attention"); the chosen row's stroke is heavier.
//
// All (the default: every place) is ranked the Map's way (Pato, MESITA-2516:
// "only keeping All is cleaner. just like in map"), Proximity^a ×
// Popularity^1 × Selected^1, and so is every family chip. All is the
// server's ONE ranked Area pool (MESITA-2379/2384):
// Google and Mesita places merged, scored and ranked there; this screen
// pages it (20 tiles at a time, more on scroll). A family chip ASKS ITS OWN
// QUESTION (MESITA-2438): it sends the family's key, so Google gets that
// family's full type list and the server lists its primary places before
// its secondary ones. Each location × row's pool is kept ten minutes
// (lib/area-pool-cache.ts), so going back to a row spends nothing. Under
// each tile, TEMPORARILY, the server's score
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
import { Compass } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import {
  apiListAreaPool,
  type AreaPool,
  type CatalogRail,
  type Place,
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
  useUserLocation,
  useUserLocationSettled,
} from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { onPlaceCreated } from "@/lib/place-created-event";
import { useOpenGooglePlace } from "@/lib/use-open-google-place";
import {
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from "@/lib/saved-places";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { barePath } from "@/lib/surface";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { CatalogTile } from "./CatalogTile";
import { useActiveLocation } from "@/lib/active-location";
import { useSocialHasNew } from "@/lib/use-social-has-new";
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

/** The column's default row: every place, one list, ranked like the Search
 *  map (Pato, MESITA-2516: "only keeping All is cleaner. just like in map").
 *  It replaced Nearby and Popular (MESITA-2426), which were one pool in two
 *  orders. */
export const ALL_CHIP = "all";
/** What the guest reads for `all` (MESITA-2534). */
export const TOP_LABEL = "Top";

/** All is every family; any other row is one family. */
export function isEveryFamily(chip: string): boolean {
  return chip === ALL_CHIP;
}
/** Home's two tabs (Pato, MESITA-2517: "another header (Places. Social)"),
 *  each its own address (Pato, MESITA-2597: "we should have home/places and
 *  home/social"). */
export const HOME_TABS = [
  { key: "places", label: "Places", href: CONSUMER_ROUTES.home },
  { key: "social", label: "Social", href: CONSUMER_ROUTES.homeSocial },
] as const;
export type HomeTab = (typeof HOME_TABS)[number]["key"];

/** The tab a Home address shows: Social at /home/social, Places anywhere
 *  else under Home. */
export function homeTabOf(pathname: string): HomeTab {
  return barePath(pathname) === CONSUMER_ROUTES.homeSocial
    ? "social"
    : "places";
}

/** The Places tab's left column, top to bottom (MESITA-2519): Top first in one scrolling list (MESITA-2534),
 *  then every guest family. The guest's hearted places are not a row: they
 *  live in the bar's Saved tab (MESITA-2522). Google Places and Mesita Selected are not guest choices
 *  (MESITA-2381): they are the sources All mixes. A family with nothing here
 *  says so rather than hiding. */
export function placesChips(): { key: string; label: string }[] {
  return [
    // The word is Top, the key stays `all` (Pato, MESITA-2534: "all is the
    // wrong word … one might thing that is the sum aof all the other
    // subests, but not"): it is the best-ranked pool, not every place.
    { key: ALL_CHIP, label: TOP_LABEL },
    ...FILTERABLE_PLACE_FAMILIES.map((f) => ({
      key: f.key as string,
      label: f.label,
    })),
  ];
}

/** Tiles drawn per page; the next page appends on scroll (MESITA-2384). */
export const PLACES_PAGE = 20;

/** The families a row asks the server for (MESITA-2438): its own key, or
 *  none for All (every family). */
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

/* NO LOCATION IS NOT A DEAD END (Pato, MESITA-2472): with no fix and no
 * saved location, every row ranks around the city's centre, the Search
 * map's own fallback. The header's location box names the city
 * (MESITA-2587: no bar above the tiles says the location is off). */

export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const { savedIds, setSaved } = useSavedPlaces();
  const openGooglePlace = useOpenGooglePlace();
  const [pool, setPool] = useState<AreaPool | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // null = the guest's current location; a saved location = search from it.
  const origin = useActiveLocation();
  const locationSettled = useUserLocationSettled();
  // No fix and no saved location, once the browser has answered: the city's
  // centre (MESITA-2472). Before it answers: nothing yet (a skeleton).
  const onCityFallback = origin === null && coords === null && locationSettled;
  const from = origin ?? coords ?? (onCityFallback ? MONTERREY_CENTER : null);
  const waitingForFix = origin === null && coords === null && !locationSettled;
  // One ranking for every chip, the Map's (MESITA-2516): the question is
  // the place and the family. Saved and the Social tab read no pool, so they
  // keep the last pool chip's family and never spend a request.
  // The tab is the address (MESITA-2597); this component lives in Home's
  // layout, so the chip, the pool and the scroll survive a tab switch.
  const tab = homeTabOf(usePathname() ?? CONSUMER_ROUTES.home);
  const [chip, setChip] = useState<string>(ALL_CHIP);
  // The family the pool was asked for (MESITA-2438): a family row's own,
  // none for All.
  const [families, setFamilies] = useState<string[]>([]);
  const requestKey = `${areaPoolKey(from)}|${
    families.length > 0 ? families.join(",") : ALL_CHIP
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
        const next = await apiListAreaPool(supabase, from, families);
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
      toast.action("Removed from favorites", {
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

  // ONE TAB BAND under Home's header (Pato, MESITA-2517: "another header
  // (Places. Social) … If places, show the horizontal catalog, is social,
  // show the social feed"): two equal tabs, the chosen one bold over a BLACK
  // BAR THE TAB'S FULL WIDTH on the strip's bottom edge (Pato, MESITA-2539:
  // "maybe make the line full now. black on the bottom. as it was"; MESITA-
  // 2530/2533 had underlined the word, MESITA-2527 first drew this bar). It replaced the left category column (MESITA-2367).
  // The strip is WHITE like the header, one light top block over the tiles,
  // its hairline the only line; the word's underline marks the tab (Pato,
  // MESITA-2537: "making the header white and the second header also light.
  // and the lateral bark darker"; MESITA-2530/2531 had a grey of its own).
  // The Social tab wears a dot while a newer event waits (MESITA-2536).
  const socialHasNew = useSocialHasNew(tab !== "social");
  const tabs = (
    <nav
      aria-label="Home"
      className="border-border bg-card flex shrink-0 border-b"
      data-home-tabs
    >
      {HOME_TABS.map((t) => {
        const on = tab === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            replace
            scroll={false}
            aria-current={on ? "page" : undefined}
            onClick={() => {
              if (!on)
                trackEvent(supabase, "home_mode_view", { mode: t.label });
            }}
            className={cn(
              "relative flex-1 py-3 text-center text-sm transition",
              on ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            {on ? (
              <span
                aria-hidden
                className="bg-foreground absolute inset-x-0 bottom-0 h-0.5"
              />
            ) : null}
            <span className="relative inline-block">
              {t.label}
              {t.key === "social" && socialHasNew ? (
                <>
                  <span
                    aria-hidden
                    className="bg-foreground absolute top-0.5 -right-3 h-2 w-2 rounded-full"
                    data-home-social-dot
                  />
                  <span className="sr-only"> · new activity</span>
                </>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  // THE PLACES TAB'S LEFT COLUMN (Pato, MESITA-2519: "keep the later view of
  // the failies. its fastwer to browse … LEFT MENU OF FAMILIES"): the
  // lateral menu of MESITA-2367 under the tabs of MESITA-2517, which tried a
  // horizontal chip row. Top first, then every family, one scrolling list (MESITA-2534) — no group colours (Pato, MESITA-2521: "remove the
  // stupid blue and orange color from the sidebar menu"; they were
  // MESITA-2484/2492). Each row a line icon
  // and a name, never an emoji (MESITA-2478); the chosen row white, bold,
  // an ink bar on its left edge and a heavier stroke.
  const chips = placesChips();
  const categoryRow = (c: { key: string; label: string }) => {
    const on = chip === c.key;
    return (
      <li key={c.key}>
        <button
          type="button"
          onClick={() => {
            if (!on) trackEvent(supabase, "home_mode_view", { mode: c.label });
            setChip(c.key);
            setFamilies(chipFamilies(c.key));
          }}
          aria-pressed={on}
          className={cn(ROW_BASE, on ? ROW_ON : ROW_OFF)}
        >
          {on ? (
            <span
              className="bg-foreground absolute inset-y-0 left-0 w-[3px]"
              aria-hidden
            />
          ) : null}
          <FamilyIcon
            name={c.key}
            className="h-4 w-4 shrink-0"
            strokeWidth={on ? 2.25 : 1.75}
          />
          <span className="min-w-0 break-words">{c.label}</span>
        </button>
      </li>
    );
  };
  const categories = (
    <nav
      className="bg-border flex w-1/4 shrink-0 flex-col"
      aria-label="Places"
      data-places-categories
    >
      {/* ONE scrolling list, Top first and the families after it, no
          pinned head above them (Pato, MESITA-2534: "don't divide al from the
          other families … now scrollable"). */}
      <ul
        role="list"
        aria-label="Families"
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        data-places-group="families"
      >
        {chips.map(categoryRow)}
      </ul>
    </nav>
  );

  // Home's header (the location alone, MESITA-2405) → the tabs → on Places
  // the family column beside the tiles, on Social the feed full width; the
  // pane scrolls on its own.
  const shell = (inner: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      {tabs}
      <div className="flex min-h-0 flex-1">
        {tab === "places" ? categories : null}
        <div
          className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
          data-home-scroller
        >
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

  // Social reads its own feed, never the catalog (MESITA-2474, MESITA-2517).
  if (tab === "social") return shell(<SocialFeed />);

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

  return shell(shown.length === 0 ? empty : tiles(shown, label, true));
}
