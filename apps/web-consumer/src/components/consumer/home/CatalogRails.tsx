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
//   ┌──┬────────────────────────────┐
//   │❤️│ ┌───────┬─────────────┐    │
//   │⭐│ │ photo │ name · facts │    │  one row per place
//   │☕│ └───────┴─────────────┘    │
//
// PLACES IS ONE VIEW (Pato, MESITA-3789: "remove places 1.0 and remake
// places 3.0 to just places"): the emoji rail at the left edge (MESITA-3781,
// tappable since MESITA-3785) beside rows of photo · facts (PlaceRowCard,
// MESITA-3662). Saved, the guest's hearts, sits above Top (MESITA-3718,
// MESITA-3763). Places 1.0, the family column beside big tiles (MESITA-2519
// … MESITA-3690), is deleted, and with it the Places 1.0 · 3.0 split of
// MESITA-3762. Social: the activity feed (SocialFeed), full width.
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
import { ChevronDown, Compass, Heart } from "lucide-react";
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
import { OVERLAY_BACKDROP_CLASS } from "@/components/consumer/overlay/overlay-presence";
import { RowFallback } from "./DiscoverFallback";
import { ROW_LIST } from "./place-grid-classes";
import { PlaceRowCard } from "./PlaceRowCard";
import { useActiveLocation } from "@/lib/active-location";
import { useSocialHasNew } from "@/lib/use-social-has-new";
import { cn, errMsg } from "@/lib/utils";

// Social is the second tab, and a big one: it loads when that tab first
// opens, not with Places (MESITA-3014). The row skeleton stands in.
const SocialFeed = dynamic(
  () => import("./SocialFeed").then((m) => m.SocialFeed),
  {
    loading: () => <RowFallback />,
  },
);

const BAR_BLUE = "before:bg-blue-600";
// SAVED'S BAR IS RED, the heart's colour (Pato, MESITA-3718: "for saved
// instead of blue selector use red. its the only exception").
const BAR_RED = "before:bg-red-600";
// ONE ROW, CLOSED OR OPEN (Pato, MESITA-3800: "it must be vertically
// aligned the closed menu with the open menu"): the rail and the open menu
// draw every family in the same 44px row, the emoji centred in the same 48px
// column, so opening only grows the width. DARK, REALLY DARK (Pato,
// MESITA-3812: "make the sidebar menu dark, really dark"): the ink token
// (bg-foreground, never a raw colour), names in text-card, the chosen row a
// lighter ink band (bg-card/15) with the blue bar (red for Saved) in both.
const RAIL_SURFACE = "bg-foreground text-card";
const RAIL_ROW =
  "text-card relative flex h-11 w-full shrink-0 items-center text-left transition";
const RAIL_ROW_ON =
  "bg-card/15 before:absolute before:inset-y-0 before:left-0 before:w-1";
const RAIL_EMOJI =
  "flex w-12 shrink-0 justify-center text-xl leading-none";

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

/** Home's two tabs, each its own address (Pato, MESITA-2597). PLACES IS
 *  ONE VIEW (Pato, MESITA-3789: "remove places 1.0 and remake places 3.0 to
 *  just places"): the emoji rail beside rows of photo · facts, at
 *  /home/places, where every "go Home" lands. Places 1.0's family column and
 *  big tiles are gone; /home/rows is a legacy address. */
export const HOME_TABS = [
  { key: "places", label: "Places", href: CONSUMER_ROUTES.home },
  { key: "social", label: "Social", href: CONSUMER_ROUTES.homeSocial },
] as const;
export type HomeTab = (typeof HOME_TABS)[number]["key"];

/** The tab a Home address shows: Social at its own address, Places
 *  anywhere else under Home. */
export function homeTabOf(pathname: string): HomeTab {
  return pathname === CONSUMER_ROUTES.homeSocial ? "social" : "places";
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
  // The open menu: mounted, then wide (its width grows from the rail's).
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuWide, setMenuWide] = useState(false);
  const railRef = useRef<HTMLElement | null>(null);
  // The rail reached its last family: the down arrow hides (MESITA-3806).
  const [railAtEnd, setRailAtEnd] = useState(false);
  const menuRef = useRef<HTMLElement | null>(null);
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
  // One Places view since MESITA-3789; the events keep a mode field.
  const cardMode = "places";
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

  const chips = placesChips();
  // PLACES' EMOJI RAIL (Pato, MESITA-3781: "put a lateral menu when you
  // only show the items … i can click the lateral vertical menu and open with
  // names"): a slim dark column (ink since MESITA-3812) at the left edge
  // with only each family's emoji, ❤️ Saved and ⭐ Top first (MESITA-3763),
  // every one full strength (MESITA-3785). A TAP PICKS AND OPENS (Pato,
  // MESITA-3792: "CLICK A, THE ITEM GETS SELECTED, THE MENU GETS LARGER").
  //
  // THE MENU IS THE RAIL, WIDER (Pato, MESITA-3800: "i don't like how it
  // vertically jumps and disaligns"): no full-card drawer and no title
  // (MESITA-3764…3779). The open menu is drawn over the Places pane only,
  // from the rail's own top-left, in the rail's rows and at the rail's
  // scroll, and grows from 48px to half the card: every emoji stays where it
  // was and the names appear beside it. A tap on the dim or Escape closes it,
  // and the rail takes the menu's scroll back.
  const selectFamily = (key: string) => {
    if (chip === key) return;
    const c = chips.find((x) => x.key === key);
    if (c) trackEvent(supabase, "home_mode_view", { mode: c.label });
    setChip(key);
    // Saved reads no pool: the last pool family stays asked.
    if (key !== SAVED_CHIP) setFamilies(chipFamilies(key));
  };
  const openMenuAt = (key: string) => {
    selectFamily(key);
    const from = railRef.current?.scrollTop ?? 0;
    setMenuOpen(true);
    requestAnimationFrame(() => {
      if (menuRef.current) menuRef.current.scrollTop = from;
      requestAnimationFrame(() => setMenuWide(true));
    });
  };
  const closeMenu = () => {
    if (railRef.current && menuRef.current)
      railRef.current.scrollTop = menuRef.current.scrollTop;
    setMenuWide(false);
    window.setTimeout(() => setMenuOpen(false), 200);
  };
  const railRows = (open: boolean) =>
    chips.map((c) => {
      const on = chip === c.key;
      return (
        <button
          key={c.key}
          type="button"
          onClick={() => {
            if (open) {
              selectFamily(c.key);
              closeMenu();
            } else openMenuAt(c.key);
          }}
          aria-label={open ? c.label : `${c.label}: pick and open families`}
          aria-haspopup={open ? undefined : "dialog"}
          aria-current={on ? "true" : undefined}
          data-on={on ? "" : undefined}
          className={cn(
            RAIL_ROW,
            on
              ? cn(RAIL_ROW_ON, c.key === SAVED_CHIP ? BAR_RED : BAR_BLUE)
              : "hover:bg-card/10",
            on && open && "font-semibold",
          )}
        >
          <span aria-hidden className={RAIL_EMOJI}>
            {c.emoji}
          </span>
          {open ? (
            <span className="min-w-0 truncate pr-3 text-base whitespace-nowrap">
              {c.label}
            </span>
          ) : null}
        </button>
      );
    });
  // MORE BELOW, AND SAYS SO (Pato, MESITA-3806: "show an arrow or
  // something at the bottom of sidebar menu to indicate that that shit is
  // scrollable"): the rail's foot fades into its own grey under a down
  // chevron; a tap scrolls most of a screen; at the last family it hides.
  const railScrolled = (el: HTMLElement) =>
    setRailAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  const emojiRail = (
    <div className={cn(RAIL_SURFACE, "relative flex w-12 shrink-0 flex-col")}>
      <nav
        ref={railRef}
        aria-label="Families"
        onScroll={(e) => railScrolled(e.currentTarget)}
        // NO SCROLLBAR (Pato, MESITA-3807: "the scrolling bar in the
        // sidebar menu looks like shit"; MESITA-3806 gave it the rows' thin
        // bar for one round): the down arrow at its foot says it scrolls.
        className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
        data-places-rail
      >
        {railRows(false)}
      </nav>
      {railAtEnd ? null : (
        <button
          type="button"
          aria-label="More families"
          onClick={() => {
            const el = railRef.current;
            if (el)
              el.scrollBy({ top: el.clientHeight * 0.8, behavior: "smooth" });
          }}
          className="from-foreground via-foreground/90 text-card/70 absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t to-transparent pb-1.5"
          data-places-rail-more
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </div>
  );
  const railMenu = menuOpen ? (
    <>
      <button
        type="button"
        aria-label="Close families"
        tabIndex={-1}
        onClick={closeMenu}
        // BLURRED, NOT JUST DIM (Pato, MESITA-3804: "make the background
        // blurred of the not menu part, else it looks weird"): every
        // overlay's own backdrop, dim and blur.
        className={cn(
          OVERLAY_BACKDROP_CLASS,
          "z-10 duration-200",
          menuWide ? "opacity-100" : "opacity-0",
        )}
      />
      <nav
        ref={menuRef}
        aria-label="Families menu"
        className={cn(
          RAIL_SURFACE,
          "shadow-elev absolute inset-y-0 left-0 z-20 flex flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain transition-[width] duration-200 ease-out motion-reduce:transition-none",
          "scrollbar-hide",
          // A THIRD OF THE SCREEN (Pato, MESITA-3809: "make this menu 1/3
          // of the screen when open, not half").
          menuWide ? "w-1/3" : "w-12",
        )}
        data-places-menu-list
      >
        {railRows(true)}
      </nav>
    </>
  ) : null;
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Home's header (the location alone, MESITA-2405) → the tabs → on Places
  // the emoji rail beside the rows, on Social the feed full width; the pane
  // scrolls on its own.
  const shell = (inner: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      {tabs}
      <div className="relative flex min-h-0 flex-1">
        {tab === "places" ? emojiRail : null}
        {tab === "places" ? railMenu : null}
        {/* ISOLATE: the rows' own z-10 (the offer and Save · Share over the
            card's stretched link, MESITA-3797) stays inside this pane, so the
            open menu's blur covers all of it and nothing under it takes a tap
            (Pato, MESITA-3804: "blurred and not clickable"). */}
        {/* THE ROWS THEMSELVES BLUR AND GO DEAF while the menu is open
            (Pato, MESITA-3807: "the sections of places must be blurred and
            not clickable"): the dim's backdrop-filter (MESITA-3804) drew no
            blur on the live page, so the pane wears the filter itself and
            takes no taps; the dim above still closes the menu. */}
        <div
          className={cn(
            "bg-card scrollbar-thin-dark isolate flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain transition-[filter] duration-200",
            tab === "places" && menuOpen && "pointer-events-none",
            tab === "places" && menuWide && "blur-sm",
          )}
          aria-hidden={tab === "places" && menuOpen ? true : undefined}
          data-home-scroller
        >
          {inner}
        </div>
      </div>
    </div>
  );

  // PLACES' ROWS (MESITA-3662, Places since MESITA-3789): the ranked
  // places, one row each, drawn as PlaceRowCard.
  const rows = (list: readonly Place[], label: string, paged: boolean) => (
    <div className="pb-6">
      <ul role="list" aria-label={label} className={ROW_LIST}>
        {list.map((place, i) => (
          <PlaceRowCard
            key={place.id}
            place={withUserDistance(place, coords)}
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
  const waiting = <RowFallback />;
  const tiles = rows;

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
