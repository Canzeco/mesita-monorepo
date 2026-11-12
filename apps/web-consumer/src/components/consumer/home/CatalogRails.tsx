"use client";

import dynamic from "next/dynamic";

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
//   │ ○ Coffee │        tile          │
//   │ ○ …   ↕  │                      │
//
// Places: the left family column beside the tiles (Pato, MESITA-2519: "keep
// the later view of the failies. its fastwer to browse") — Top first,
// then every family, scrolling on its own, no colour stripes (MESITA-2521:
// "we don't need to colors now"). Saved, the guest's hearts, sits above Top
// (Pato, MESITA-3718: "Add Saved above Top … remember it is a heart"); it
// left the column in MESITA-2522 for the bar's Saved tab. MESITA-2517 tried a
// horizontal chip row and Pato sent it back. Social: the activity feed
// (SocialFeed), full width. Every row's mark is the family's emoji (Pato,
// MESITA-3683; MESITA-2478's monochrome line icons until then). Places 2.0,
// 3.0 and 4.0 were tried beside this list (MESITA-3658…3680) and deleted
// (MESITA-3684); Places 3.0 came back as its own tab, the chip row over rows
// of photo · facts (Pato, MESITA-3762: "I want Places 1.0 and Places 3.0").
//
// All (the default: every place) is ranked the Map's way (Pato, MESITA-2516:
// "only keeping All is cleaner. just like in map"), Proximity ×
// Popularity × Premier's tier (MESITA-2925), and so is every family chip. All is the
// server's ONE ranked Area pool (MESITA-2379/2384):
// Google and Mesita places merged, scored and ranked there; this screen
// pages it (20 tiles at a time, more on scroll). A family chip ASKS ITS OWN
// QUESTION (MESITA-2438): it sends the family's key, so Google gets that
// family's full type list and the server lists its primary places before
// its secondary ones. Each location × row's pool is kept ten minutes
// (lib/area-pool-cache.ts), so going back to a row spends nothing. Above
// each tile, TEMPORARILY, the Search map's score tag: the sources that found
// it, proximity · popularity · final (MESITA-2708). `useUserLocation` asks
// for location on mount. No search bar.
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
import { Compass, Heart, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import {
  apiFillAreaPool,
  apiListAreaPool,
  type AreaPool,
  mergeFilledPlaces,
  type Place,
} from "@/lib/api/places";
import { EFError } from "@/lib/api/_invoke";
import {
  areaPoolKey,
  dropAreaPool,
  readAreaPool,
  writeAreaPool,
} from "@/lib/area-pool-cache";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics/track";
import {
  useUserLocation,
  useUserLocationSettled,
} from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { useCreatedPlaces, withCreatedPlaces } from "@/lib/created-places";
import { useOpenGooglePlace } from "@/lib/use-open-google-place";
import { useCardSaveShare } from "@/lib/use-card-save-share";
import { readSavedPlacePreviews, useSavedPlaces } from "@/lib/saved-places";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { CatalogTile } from "./CatalogTile";
import { DiscoverFallback, PLACES_LIST, RowFallback } from "./DiscoverFallback";
import { GRID_CHIPS, ROW_LIST } from "./place-grid-classes";
import { PlaceRowCard } from "./PlaceRowCard";
import { useActiveLocation } from "@/lib/active-location";
import { useSocialHasNew } from "@/lib/use-social-has-new";
import { cn, errMsg } from "@/lib/utils";

// Social is the second tab, and a big one: it loads when that tab first
// opens, not with Places (MESITA-3014). The tile skeleton stands in.
const SocialFeed = dynamic(
  () => import("./SocialFeed").then((m) => m.SocialFeed),
  {
    loading: () => <DiscoverFallback />,
  },
);

// The tile list's classes (PLACES_LIST) live in DiscoverFallback.tsx, beside
// the skeleton that draws the same column (MESITA-2701).

// 8px in from the left (Pato, MESITA-3445: "put the families a bit more to
// the left, reduce the left margin"); 12px from MESITA-3441.
const ROW_BASE =
  "relative flex w-full items-center gap-1.5 py-3.5 pr-1.5 pl-2 text-left text-xs leading-tight transition";
// THE CHOSEN FAMILY: white, with a 5px BLUE bar on its left edge, the place
// screen's blue (Pato, MESITA-3690: "make the selector blue of red"; it was
// red-600 in MESITA-3687, blue-600 first in MESITA-3685). 3px until
// MESITA-3689 ("a bit wider").
const ROW_ON =
  "bg-card text-foreground font-semibold before:absolute before:inset-y-0 before:left-0 before:w-[5px]";
const BAR_BLUE = "before:bg-blue-600";
// SAVED'S BAR IS RED, the heart's colour (Pato, MESITA-3718: "for saved
// instead of blue selector use red. its the only exception").
const BAR_RED = "before:bg-red-600";
const ROW_OFF = "text-foreground hover:bg-card/60";
// PLACES 3.0'S FAMILY DRAWER ROWS (Pato, MESITA-3775: "the fams too
// small"): body-size names and a 20px emoji, 20px in from the edge like the
// title; the chosen row Home's grey with the same blue (red for Saved) bar.
const MENU_ROW =
  "text-foreground relative flex w-full items-center gap-3 px-5 py-2.5 text-left text-base transition";
const MENU_ROW_ON =
  "bg-background font-semibold before:absolute before:inset-y-0 before:left-0 before:w-1";

/** The column's default row: every place, one list, ranked like the Search
 *  map (Pato, MESITA-2516: "only keeping All is cleaner. just like in map").
 *  It replaced Nearby and Popular (MESITA-2426), which were one pool in two
 *  orders. */
export const ALL_CHIP = "all";
/** What the guest reads for `all` (MESITA-2534). */
export const TOP_LABEL = "Top";

/** The guest's hearted places (MESITA-3718): read from the local saved
 *  store, never the pool. */
export const SAVED_CHIP = "saved";
export const SAVED_LABEL = "Saved";

/** All is every family; any other row is one family. */
export function isEveryFamily(chip: string): boolean {
  return chip === ALL_CHIP;
}

/** Home's three tabs, each its own address (Pato, MESITA-2597; MESITA-3762:
 *  "I want Places 1.0 and Places 3.0"):
 *    1.0  the family column beside big tiles, /home/places, where every
 *         "go Home" lands
 *    3.0  the chip row over rows of two squares, photo · facts with the
 *         offer and Save · Share (MESITA-3662…3671), /home/rows */
export const HOME_TABS = [
  { key: "places", label: "Places 1.0", href: CONSUMER_ROUTES.home },
  { key: "rows", label: "Places 3.0", href: CONSUMER_ROUTES.homeRows },
  { key: "social", label: "Social", href: CONSUMER_ROUTES.homeSocial },
] as const;
export type HomeTab = (typeof HOME_TABS)[number]["key"];

/** The tab a Home address shows: Social and Places 3.0 at their own
 *  addresses, Places 1.0 anywhere else under Home. */
export function homeTabOf(pathname: string): HomeTab {
  if (pathname === CONSUMER_ROUTES.homeSocial) return "social";
  return pathname === CONSUMER_ROUTES.homeRows ? "rows" : "places";
}

/** A place's family word for Places 3.0's fact line when it has no kind of
 *  its own: the first family the server ranked it under, or null. */
export function placeFamilyLabel(place: Place): string | null {
  const key = place.area?.familyKeys?.[0];
  if (!key) return null;
  return FILTERABLE_PLACE_FAMILIES.find((f) => f.key === key)?.label ?? null;
}

/** The Places tab's left column, top to bottom (MESITA-2519): Saved, the
 *  guest's hearts (MESITA-3718), then Top in one scrolling list (MESITA-2534),
 *  then every guest family. Google Places and Mesita Places are not guest choices
 *  (MESITA-2381): they are the sources All mixes. A family with nothing here
 *  says so rather than hiding. */
export function placesChips(): { key: string; label: string; emoji: string }[] {
  return [
    // A HEART, AND THE WORD IS SAVED, never Favorites (Pato, MESITA-3718).
    { key: SAVED_CHIP, label: SAVED_LABEL, emoji: "❤️" },
    // The word is Top, the key stays `all` (Pato, MESITA-2534: "all is the
    // wrong word … one might thing that is the sum aof all the other
    // subests, but not"): it is the best-ranked pool, not every place.
    { key: ALL_CHIP, label: TOP_LABEL, emoji: "⭐" },
    ...FILTERABLE_PLACE_FAMILIES.map((f) => ({
      key: f.key as string,
      label: f.label,
      emoji: f.emoji,
    })),
  ];
}

/** The Catalog's page size when the server names none (MESITA-2909). Pages
 *  come from the server now (MESITA-3044): the next one appends on scroll. */
export const PLACES_PAGE = 20;

/** The families a row asks the server for (MESITA-2438): its own key, or
 *  none for All (every family). */
export function chipFamilies(chip: string): string[] {
  return isEveryFamily(chip) ? [] : [chip];
}

/** The places a row shows from the pool, in the server's order. A family
 *  row's pool is already that family's (MESITA-2438); the filter stays as a
 *  guard when area.familyKeys and family_keys disagree. */
export function poolPlaces(pool: AreaPool, chip: string): Place[] {
  return isEveryFamily(chip)
    ? pool.places
    : pool.places.filter((p) => (p.area?.familyKeys ?? []).includes(chip));
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
  const openGooglePlace = useOpenGooglePlace();
  const [pool, setPool] = useState<AreaPool | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Try again re-runs the fetch for the same request key (MESITA-2921): the
  // old link pointed at the page already open, so nothing refetched.
  const [retry, setRetry] = useState(0);
  // null = the guest's current location; a saved location = search from it.
  const origin = useActiveLocation();
  const locationSettled = useUserLocationSettled();
  // No fix and no saved location, once the browser has answered: the city's
  // centre (MESITA-2472). Before it answers: nothing yet (a skeleton).
  const onCityFallback = origin === null && coords === null && locationSettled;
  const base = origin ?? coords ?? (onCityFallback ? MONTERREY_CENTER : null);
  // NO RADIUS (MESITA-2909): the Catalog ranks every Mesita place from
  // this point; a saved pin's radius no longer cuts anything.
  const from = base;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const requestKey = `${areaPoolKey(from)}|${
    families.length > 0 ? families.join(",") : ALL_CHIP
  }`;

  useEffect(() => {
    // Until the browser answers there is no point to rank from yet.
    if (waitingForFix) return;
    let cancelled = false;
    // A pool kept from the last ten minutes paints at once: no request.
    const kept = readAreaPool(requestKey);
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setPool(kept);
      setFetchError(null);
    });
    const fetchPool = async () => {
      try {
        const next = await apiListAreaPool(supabase, from, families);
        if (cancelled) return;
        writeAreaPool(requestKey, next);
        setPool(next);
        setFetchError(null);
      } catch (err) {
        if (cancelled) return;
        // The EF's code and requestId join this failure to its
        // `catalog_page_error` log line (MESITA-2921).
        const ef = err instanceof EFError ? err : null;
        console.warn("[catalog] load failed", {
          code: ef?.code ?? null,
          requestId: ef?.body?.requestId ?? null,
        });
        setFetchError(errMsg(err, "Couldn't load the catalog"));
        setPool({
          kind: "none",
          places: [],
          order: [],
          asked: 0,
          rankedFrom: null,
        });
      }
    };
    if (!kept) void fetchPool();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, requestKey, retry]);

  // A GOOGLE CARD THE GUEST OPENED, SAVED OR SHARED IS A MESITA CARD once
  // the create lands (Pato, MESITA-2683: "the profile has been created but i
  // still have the old not created profile data in the carousel"): its tile
  // swaps in place, photo and profile link, in this pool and in any kept
  // one, wherever the create happened. It replaced a reload of the whole
  // pool on the create (MESITA-2307), which missed a Home that was not on
  // screen and paid a Google call for one card.
  const createdPlaces = useCreatedPlaces();
  const { savedIds, hydrated: savedHydrated } = useSavedPlaces();

  // RANK ONCE, FILL BY ID (MESITA-3057, Pato: "don't bring the data of all
  // 1000 places in one run … have all the ids … then populate with data and
  // the images"): the pool holds every ranked id (`order`) and the cards
  // filled so far; the sentinel under the last tile asks for the next
  // `pageSize` ids' cards, scored from the point the order was ranked at,
  // until `asked` reaches the end. One fill at a time per question; a fill
  // that lands for an older question, or after `asked` moved, is dropped, so
  // no slice is skipped. A failed fill retries after 1 s, 2 s and 4 s, then
  // the next time the sentinel scrolls into view; `fill_invalid` never
  // retries. Two empty fills in a row mean the order went stale: rank again.
  const sentinel = useRef<HTMLLIElement | null>(null);
  const filling = useRef<string | null>(null);
  const fails = useRef(0);
  const emptyRun = useRef(0);
  const invalidAt = useRef<string | null>(null);
  const [fillRetry, setFillRetry] = useState(0);
  // The question on screen now: a fill that lands for an older one is dropped.
  const liveKey = useRef(requestKey);
  useEffect(() => {
    liveKey.current = requestKey;
    fails.current = 0;
    emptyRun.current = 0;
  }, [requestKey]);
  const shown: Place[] = useMemo(
    () =>
      pool ? withCreatedPlaces(poolPlaces(pool, chip), createdPlaces) : [],
    [pool, chip, createdPlaces],
  );
  const asked = pool?.asked ?? 0;
  const order = pool?.order;
  const hasMore = order !== undefined && asked < order.length;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !pool || !hasMore || typeof IntersectionObserver === "undefined")
      return;
    const key = requestKey;
    const start = asked;
    const ids = pool.order.slice(start, start + (pool.pageSize ?? PLACES_PAGE));
    const rankedFrom = pool.rankedFrom;
    const tag = `${key}@${start}`;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (filling.current === tag || invalidAt.current === tag) return;
        filling.current = tag;
        void apiFillAreaPool(supabase, rankedFrom, families, ids)
          .then((filled) => {
            if (key !== liveKey.current) return;
            fails.current = 0;
            emptyRun.current = filled.length === 0 ? emptyRun.current + 1 : 0;
            if (emptyRun.current >= 2) {
              emptyRun.current = 0;
              dropAreaPool(key);
              setRetry((n) => n + 1);
              return;
            }
            setPool((cur) => {
              if (!cur || key !== liveKey.current || cur.asked !== start)
                return cur;
              const merged = mergeFilledPlaces(cur, filled, start + ids.length);
              writeAreaPool(key, merged);
              return merged;
            });
          })
          .catch((err) => {
            // The EF's code and requestId join this to its log line.
            const ef = err instanceof EFError ? err : null;
            const invalid = ef?.code === "fill_invalid";
            (invalid ? console.error : console.warn)("[catalog] fill failed", {
              start,
              size: ids.length,
              code: ef?.code ?? null,
              requestId: ef?.body?.requestId ?? null,
              attempt: fails.current + 1,
            });
            if (invalid) invalidAt.current = tag;
            if (invalid || disposed || key !== liveKey.current) return;
            fails.current += 1;
            if (fails.current <= 3) {
              timer = setTimeout(
                () => setFillRetry((n) => n + 1),
                1000 * 2 ** (fails.current - 1),
              );
            }
          })
          .finally(() => {
            if (filling.current === tag) filling.current = null;
          });
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => {
      disposed = true;
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, order, requestKey, fillRetry]);

  /** What the events say about a tile: its source, rank and final score. */
  const tileFacts = (place: Place, rank: number) => ({
    source: place.area?.source ?? (place.googleOnly ? "google" : "mesita"),
    rank,
    final: place.area?.final ?? null,
  });

  // SAVE AND SHARE ON A TILE (MESITA-2663, MESITA-2668): the shared card
  // hook, which creates a Google-only place first. A save is a
  // `home_card_save` with the tile's facts.
  // Places 3.0 says which it is, so the two can be compared (MESITA-3762).
  const cardMode = tab === "rows" ? "rows" : "places";
  const cards = useCardSaveShare((place, rank) =>
    trackEvent(supabase, "home_card_save", {
      mode: cardMode,
      place_id: place.id,
      ...tileFacts(place, rank),
    }),
  );

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
              "relative flex-1 px-1 py-3 text-center text-sm whitespace-nowrap transition",
              // INK, NOT BLUE (Pato, MESITA-3687: "only paint the left
              // sidebar menu with blue; the places and social keep them
              // black"): MESITA-3685's blue tab lasted minutes.
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
  // and a name, never an emoji (MESITA-2478); the chosen row a white rounded
  // row inset in the grey rail, bold and a heavier stroke (Pato, MESITA-3337:
  // "the categorical border gray area at the left of selected category looks
  // like shit": the 3px ink bar on its left edge is gone). EDGE TO EDGE
  // AGAIN, NO BOX (Pato, MESITA-3441: "the families must be at the left, not
  // in a box ... all white and it touches both left and right border"): the
  // list has no inset and the rows no rounding; the chosen row is plain
  // white across the whole column, still with no bar.
  const chips = placesChips();
  const categoryRow = (c: { key: string; label: string; emoji: string }) => {
    const on = chip === c.key;
    return (
      <li key={c.key}>
        <button
          type="button"
          onClick={() => {
            if (!on) trackEvent(supabase, "home_mode_view", { mode: c.label });
            setChip(c.key);
            // Saved reads no pool: the last pool row's family stays asked.
            if (c.key !== SAVED_CHIP) setFamilies(chipFamilies(c.key));
          }}
          aria-pressed={on}
          className={cn(
            ROW_BASE,
            on
              ? cn(ROW_ON, c.key === SAVED_CHIP ? BAR_RED : BAR_BLUE)
              : ROW_OFF,
          )}
        >
          {/* THE FAMILY'S EMOJI (Pato, MESITA-3683: "add emojis instead
              of those black-white icons to the sidebar menu"); MESITA-2478's
              line icons are gone from the column. */}
          <span
            aria-hidden
            className="w-4 shrink-0 text-center text-sm leading-none"
          >
            {c.emoji}
          </span>
          <span className="min-w-0 break-words">{c.label}</span>
        </button>
      </li>
    );
  };
  // THE PAGE'S GREY (≈ #e6e6e6): Pato asked for "a bit lighter" than
  // bg-border (MESITA-3682, which tried bg-muted, #efefef), then "a bit
  // darker" (MESITA-3684); bg-background sits between the two.
  const categories = (
    <nav
      className="bg-background flex w-1/4 shrink-0 flex-col"
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

  // PLACES 3.0'S FAMILY CHIPS (MESITA-3658, MESITA-3762): the column's
  // rows, ❤️ Saved first and Top after it (Pato, MESITA-3763: "add saved as
  // option before top"), as one scrolling line of
  // pills, each with its family's emoji (MESITA-3668), so the rows get the
  // whole width. The chosen pill is ink. The row and the column share
  // `chip`, so a family carries across the two tabs.
  // THE MENU DISC BEFORE THE PILLS OPENS PLACES 1.0'S COLUMN AS A LEFT DRAWER
  // (Pato, MESITA-3764: "use the lateral menu of places 1.0 but in places
  // 3.0 instead of the ugly ass this filters page"): the same rows, one pick,
  // and the drawer closes and centres that family's pill. It replaced
  // Search's multi-pick Filters sheet (MESITA-3666); Search keeps its own.
  const pickedFromMenu = () => {
    setMenuOpen(false);
    requestAnimationFrame(() =>
      document
        .querySelector("[data-places-chips] [aria-pressed='true']")
        ?.scrollIntoView({ block: "nearest", inline: "center" }),
    );
  };
  const chipRow = (
    <div className="bg-card flex shrink-0 items-center gap-1.5 pl-3">
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Families"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        className="bg-border/60 text-foreground hover:bg-border relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition after:absolute after:-inset-1.5 active:scale-[0.97]"
        data-places-menu
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <nav
        className={cn("bg-card min-w-0 flex-1 pl-0", GRID_CHIPS)}
        aria-label="Families"
        data-places-chips
      >
        {chips.map((c) => {
          const on = chip === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={(e) => {
                if (!on)
                  trackEvent(supabase, "home_mode_view", { mode: c.label });
                setChip(c.key);
                // Saved reads no pool: the last pool row's family stays.
                if (c.key !== SAVED_CHIP) setFamilies(chipFamilies(c.key));
                e.currentTarget.scrollIntoView({
                  block: "nearest",
                  inline: "center",
                });
              }}
              aria-pressed={on}
              className={cn(
                "relative h-8 shrink-0 rounded-full px-3 text-xs transition after:absolute after:inset-x-0 after:-inset-y-1.5",
                on
                  ? "bg-foreground text-card font-semibold"
                  : "bg-border/60 text-foreground hover:bg-border",
              )}
            >
              <span aria-hidden className="mr-1">
                {c.emoji}
              </span>
              {c.label}
            </button>
          );
        })}
      </nav>
      <LocalSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        ariaLabel="Families"
        from="left"
      >
        <h2 className="shrink-0 px-5 pt-5 pb-2 text-lg font-semibold tracking-tight">
          Families
        </h2>
        <ul
          role="list"
          aria-label="Families"
          className="scrollbar-thin-dark min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-10"
          data-places-menu-list
        >
          {chips.map((c) => {
            const on = chip === c.key;
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (!on)
                      trackEvent(supabase, "home_mode_view", { mode: c.label });
                    setChip(c.key);
                    // Saved reads no pool: the last pool family stays asked.
                    if (c.key !== SAVED_CHIP) setFamilies(chipFamilies(c.key));
                    pickedFromMenu();
                  }}
                  aria-pressed={on}
                  className={cn(
                    MENU_ROW,
                    on
                      ? cn(
                          MENU_ROW_ON,
                          c.key === SAVED_CHIP ? BAR_RED : BAR_BLUE,
                        )
                      : "hover:bg-background/60",
                  )}
                >
                  <span
                    aria-hidden
                    className="w-6 shrink-0 text-center text-xl leading-none"
                  >
                    {c.emoji}
                  </span>
                  <span className="min-w-0 truncate">{c.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {/* IT SCROLLS, AND SAYS SO (Pato, MESITA-3779: "add sidebar to menu
            to explain that its scrollable"): Home's thin grey scrollbar on
            the list, and the last rows fade into the panel's white. */}
        <div
          aria-hidden
          className="from-popover pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t to-transparent"
        />
      </LocalSheet>
    </div>
  );

  // Home's header (the location alone, MESITA-2405) → the tabs → on Places
  // 1.0 the family column beside the tiles, on Places 3.0 the chip row over
  // the rows, on Social the feed full width; the pane scrolls on its own.
  const shell = (inner: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      {tabs}
      {tab === "rows" ? chipRow : null}
      <div className="flex min-h-0 flex-1">
        {tab === "places" ? categories : null}
        <div
          className="bg-card scrollbar-thin-dark flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
          data-home-scroller
        >
          {inner}
        </div>
      </div>
    </div>
  );

  // PLACES 3.0 (MESITA-3662, MESITA-3762): the same places, order and
  // paging, one row each, drawn as PlaceRowCard. The family word fills a
  // missing kind on Top only; a family chip already says it.
  const rows = (list: readonly Place[], label: string, paged: boolean) => (
    <div className="pb-6">
      <ul role="list" aria-label={label} className={ROW_LIST}>
        {list.map((place, i) => (
          <PlaceRowCard
            key={place.id}
            place={withUserDistance(place, coords)}
            family={isEveryFamily(chip) ? placeFamilyLabel(place) : null}
            saved={cards.isSaved(place)}
            onToggle={() => cards.toggle(place, i + 1)}
            onShare={() => cards.share(place)}
            onOpen={() =>
              trackEvent(supabase, "home_card_open", {
                mode: cardMode,
                place_id: place.id,
                ...tileFacts(place, i + 1),
              })
            }
            onOpenGoogle={() => openGooglePlace(place)}
          />
        ))}
        {paged && hasMore ? (
          <li ref={sentinel} aria-hidden className="h-px" data-places-more />
        ) : null}
      </ul>
    </div>
  );
  // One list draw per tab: rows on Places 3.0, tiles on Places 1.0.
  const waiting = tab === "rows" ? <RowFallback /> : <DiscoverFallback />;

  const tiles = (list: readonly Place[], label: string, paged: boolean) => {
    if (tab === "rows") return rows(list, label, paged);
    const page = list;
    return (
      <div className="pb-6">
        <ul role="list" aria-label={label} className={PLACES_LIST}>
          {page.map((place, i) => {
            const located = withUserDistance(place, coords);
            return (
              <Fragment key={place.id}>
                {/* NO SCORE ON THE PHOTO (Pato, MESITA-3319: "remove scores
                    from image for the moment"): the server's breakdown sat
                    on the photo from MESITA-3053 (MESITA-2708 had it under
                    the tile); it lives on the place screen's Overview now,
                    the Score box. Search's own overlay stays. */}
                <CatalogTile
                  place={located}
                  saved={cards.isSaved(place)}
                  onToggle={() => cards.toggle(place, i + 1)}
                  onShare={() => cards.share(place)}
                  onOpen={() =>
                    trackEvent(supabase, "home_card_open", {
                      mode: cardMode,
                      place_id: place.id,
                      ...tileFacts(place, i + 1),
                    })
                  }
                  onOpenGoogle={() => openGooglePlace(place)}
                />
                {/* The score-breakdown box is hidden (Pato, MESITA-2660:
                    "remove the boxes for the moment"); AreaDiagnostics.tsx
                    stays for when it comes back. */}
              </Fragment>
            );
          })}
          {paged && hasMore ? (
            <li ref={sentinel} aria-hidden className="h-px" data-places-more />
          ) : null}
        </ul>
      </div>
    );
  };

  // Social reads its own feed, never the catalog (MESITA-2474, MESITA-2517).
  if (tab === "social") return shell(<SocialFeed />);

  // SAVED (MESITA-3718): the hearts, newest first, as Home's own tiles; local,
  // so no error and no paging. Unsaving here drops the tile (with Undo).
  if (chip === SAVED_CHIP) {
    if (!savedHydrated) return shell(waiting);
    const saved = savedPlaceList(savedIds, readSavedPlacePreviews<Place>());
    return shell(
      saved.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on a place and it lands here."
        />
      ) : (
        tiles(saved, SAVED_LABEL, false)
      ),
    );
  }

  // BOTH WAITS DRAW THE TILE COLUMN ITSELF (Pato, MESITA-2701: "the
  // placeholders must be similar to the page you are loading, like the
  // sizes"): the same three tile silhouettes, 60/40 with the Save · Share
  // row, in the list's own pb-6 and gaps (DiscoverFallback.tsx). Locating
  // drew one bare square before, so it grew to three, then to tiles.
  if (waitingForFix) return shell(waiting);

  if (fetchError) {
    return shell(
      <EmptyState
        icon={Compass}
        title="Couldn't load the catalog"
        description="Tonight's places didn't come back. Try again in a moment."
        action={{ label: "Try again", onClick: () => setRetry((n) => n + 1) }}
      />,
    );
  }

  if (pool === null) return shell(waiting);

  const label = chips.find((c) => c.key === chip)?.label ?? "Places";
  // The Catalog has no radius (MESITA-2909): an empty pool is an empty
  // catalog (or every place under the floor), wherever the point is.
  const empty = isEveryFamily(chip) ? (
    <EmptyState
      icon={Compass}
      title="No places yet"
      description="Check back soon."
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
