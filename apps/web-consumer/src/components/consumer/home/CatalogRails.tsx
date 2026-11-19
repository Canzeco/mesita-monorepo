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
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Compass, Heart, LayoutGrid, Store, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { useServerProfile, useViewer } from "@/lib/identity-context";
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
import { CategoriesModal } from "./CategoriesModal";
import { RowFallback } from "./DiscoverFallback";
import { ROW_LIST } from "./place-grid-classes";
import { PlaceRowCard } from "./PlaceRowCard";
import { useActiveLocation } from "@/lib/active-location";
import { cn, errMsg } from "@/lib/utils";

// Social is the second tab, and a big one: it loads when that tab first
// opens, not with Places (MESITA-3014). The row skeleton stands in.
const SocialFeed = dynamic(
  () => import("./SocialFeed").then((m) => m.SocialFeed),
  {
    loading: () => <RowFallback />,
  },
);

// NO BLUE BAR (Pato, 2026-11-15, MESITA-4037: "remove blue from selected
// family is not required anymore"): the white band alone marks a chosen
// family. SAVED'S BAR IS RED, the heart's colour (Pato, MESITA-3718: "for saved
// instead of blue selector use red. its the only exception").
// ONE ROW, CLOSED OR OPEN (Pato, MESITA-3800: "it must be vertically
// aligned the closed menu with the open menu"): the rail and the open menu
// draw every family in the same 44px row, the emoji centred in the same 48px
// column, so opening only grows the width. DARK, REALLY DARK (Pato,
// MESITA-3812: "make the sidebar menu dark, really dark"): the ink token
// (bg-foreground, never a raw colour), names in text-card, the chosen row a
// lighter ink band (bg-card/15) with the blue bar (red for Saved) in both.
// THE CHOSEN ROW IS WHITE (Pato, MESITA-4015: "selected menu item must be
// white, not dark. white with blue / red stuff at the left"): a solid card
// band with ink text, the 4px blue bar (red for Saved) at its left; the
// blue bar left with MESITA-4037, Saved keeps its red one.
// LIGHT AGAIN (Pato, 2026-11-17, MESITA-4268: "lets try making the later
// bar instead of dark, light"): the grey fill token with ink names, no
// edge line (MESITA-4270 took MESITA-4268's hairline away).
// Reverses MESITA-3812/3813's almost-ink surface.
// A HORIZONTAL STRIP, NO SIDE RAIL (Pato, 2026-11-18, MESITA-4410: "i
// don't want a lateral menu. i want a menu and horizontal menu below
// places"): under the Places · Social strip, one scrolling row of pills,
// emoji and name; the chosen pill is ink, the rest grey (the app's chip
// pair). A menu button at its left opens every family at once. The emoji
// rail and its widening menu (MESITA-3781…MESITA-4294) are gone.
// UBER EATS' CATEGORY ROW (Pato, 2026-11-18, MESITA-4410: "it must look
// the horizontal menu like the horizontal menu of uber eats listing pizza
// and all that shit as categories"): a big emoji over its name, no box, no
// pill; the chosen one's name is bold ink over a short ink bar, the rest
// regular grey. Every tile is the same 64px column, so the row reads as a
// shelf of icons.
// SMALLER, ON GREY, NAMED (Pato, 2026-11-18, MESITA-4415: "add a carousel
// in a gray background, make icons smaller, and actually mention what is
// about. very small letters for the family text. icon is enough"): the row
// sat on a grey band under a small label (both gone, MESITA-4416/4418); 24px emoji in 52px
// columns, the names at the floor size (type-meta, 10px).
const CAT =
  "flex w-[52px] shrink-0 flex-col items-center gap-0.5 pb-1 type-meta transition active:scale-[0.96]";
// WHITE, BETWEEN TWO LINES, IN CIRCLES (Pato, 2026-11-18, MESITA-4416:
// "border / families carousel (white background, fams in white circles,
// selected circle black background) / border"): each emoji in a 40px white
// circle with a hairline ring; the chosen circle is ink. The line above is
// the Places · Social strip's own hairline, so the band draws only the one
// below (two lines would stack into 2px).
const CAT_EMOJI =
  "flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none transition";
const CAT_EMOJI_OFF = "bg-card border-border border";
// A FAINT TINT TELLS THEM APART (Pato, 2026-11-18, MESITA-4421: "special
// families slightly purple background, normal families slightly blue, but
// really lightly"): Saved and Top a whisper of purple, every family a
// whisper of blue; Menu stays white; the chosen circle stays ink.
// STRONGER, AND RED (Pato, MESITA-4423: "those backgrounds are too light
// and look like shit. and not purple. red"): the specials a light red,
// the families a light blue, each with a ring of its own hue.
const CAT_TINT_SPECIAL = "bg-red-100 border border-red-200";
const CAT_TINT_FAMILY = "bg-sky-100 border border-sky-200";
const CAT_EMOJI_ON = "bg-foreground border border-transparent";
const CAT_NAME = "relative w-full truncate text-center";

/** Saved, Near and Top: not families, so the Categories modal lists them
 *  first, apart (MESITA-4417, Near since MESITA-4423). */
function isSpecial(key: string): boolean {
  return key === SAVED_CHIP || key === NEAR_CHIP || key === ALL_CHIP;
}

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

/** NEAR (Pato, 2026-11-18, MESITA-4423: "build (Near and Top) and then the
 *  categories. for the moment near and top must have the same feed"): every
 *  family, the same pool and order as Top until Pato tunes its own ranking. */
export const NEAR_CHIP = "near";
export const NEAR_LABEL = "Near";

/** Top and Near are every family; any other row is one family. */
export function isEveryFamily(chip: string): boolean {
  return chip === ALL_CHIP || chip === NEAR_CHIP;
}

/** Home's two tabs, each its own address (Pato, MESITA-2597). PLACES IS
 *  ONE VIEW (Pato, MESITA-3789: "remove places 1.0 and remake places 3.0 to
 *  just places"): the emoji rail beside rows of photo · facts, at
 *  /home/places, where every "go Home" lands. Places 1.0's family column and
 *  big tiles are gone; /home/rows is a legacy address. */
// AN ICON BESIDE EACH WORD (Pato, 2026-11-18, MESITA-4346: "maybe in
// Places and [Social] add an icon"): a storefront for the places, people
// for Social, in the word's own colour.
export const HOME_TABS = [
  { key: "places", label: "Places", href: CONSUMER_ROUTES.home, Icon: Store },
  { key: "social", label: "Social", href: CONSUMER_ROUTES.homeSocial, Icon: Users },
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
    // Near before Top (MESITA-4423); the same feed as Top for now.
    { key: NEAR_CHIP, label: NEAR_LABEL, emoji: "📍" },
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
  const viewer = useViewer();
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
  // ?row=saved OPENS ON SAVED (MESITA-4327): Me's Saved box is a shortcut
  // to this row, not a page of its own. Read during render (React's
  // prop-to-state pattern), once per ask, so a tap on another row after
  // it still wins.
  const rowAsk = useSearchParams()?.get("row") ?? null;
  const [lastRowAsk, setLastRowAsk] = useState<string | null>(null);
  if (rowAsk !== lastRowAsk) {
    setLastRowAsk(rowAsk);
    if (rowAsk === SAVED_CHIP) setChip(SAVED_CHIP);
  }
  // The family the pool was asked for (MESITA-2438): a family row's own,
  // none for All.
  const [families, setFamilies] = useState<string[]>([]);
  // The menu: every family at once, dropped over the rows (MESITA-4410).
  const [menuOpen, setMenuOpen] = useState(false);
  const stripRef = useRef<HTMLElement | null>(null);
  // THE POOL IS THIS GUEST'S (autoplan eng E1, MESITA-4207): its offers are
  // narrowed per guest, so a pool kept across a sign-out or sign-in would
  // show another guest's chips; the guest is part of the key.
  const guest = useServerProfile()?.id ?? "anon";
  const requestKey = `${guest}|${areaPoolKey(from)}|${
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
  // No "new" dot on Social (MESITA-4044, Pato: "of course there are always
  // new events"): MESITA-2536's dot and its one-minute poll are gone.
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
              // 16px, the app's body step (MESITA-4046, Pato: "looks so
              // fucking small the selected place … make it bigger"); 14px
              // before. The chosen word is bold ink, the other regular grey.
              "flex flex-1 justify-center px-1 text-base whitespace-nowrap transition",
              on ? "text-foreground font-bold" : "text-muted-foreground",
            )}
          >
            <span className="relative flex items-center gap-1.5 py-3">
              <t.Icon
                aria-hidden
                className="h-[18px] w-[18px] shrink-0"
                strokeWidth={on ? 2.5 : 2}
              />
              {t.label}
              {on ? (
                <span
                  aria-hidden
                  // AN INK LINE AS WIDE AS THE WORD, 3px, on the strip's
                  // bottom hairline (MESITA-4046; MESITA-4039's 32px line
                  // under a 14px word read too timid). Still black, never
                  // the whole half (MESITA-3892's full-width blue bar).
                  className="bg-foreground absolute inset-x-0 bottom-0 h-[3px] rounded-full"
                />
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  // NO SAVED FOR ANONYMOUS (Pato, 2026-11-17, MESITA-4288: "anonymous users
  // cannot save places. don't show that option"): the rail starts at Top.
  const chips = placesChips().filter(
    (c) => viewer !== "anonymous" || c.key !== SAVED_CHIP,
  );
  const selectFamily = (key: string) => {
    if (chip === key) return;
    const c = chips.find((x) => x.key === key);
    if (c) trackEvent(supabase, "home_mode_view", { mode: c.label });
    setChip(key);
    // Saved reads no pool: the last pool family stays asked.
    if (key !== SAVED_CHIP) setFamilies(chipFamilies(key));
  };
  const pill = (c: { key: string; label: string; emoji: string }, inMenu: boolean) => {
    const on = chip === c.key;
    return (
      <button
        key={c.key}
        type="button"
        onClick={() => {
          selectFamily(c.key);
          if (inMenu) setMenuOpen(false);
        }}
        aria-pressed={on}
        data-on={on ? "" : undefined}
        className={cn(CAT, inMenu && "w-auto")}
      >
        <span
          aria-hidden
          className={cn(
            CAT_EMOJI,
            on ? CAT_EMOJI_ON : isSpecial(c.key) ? CAT_TINT_SPECIAL : CAT_TINT_FAMILY,
          )}
        >
          {c.emoji}
        </span>
        <span
          className={cn(
            CAT_NAME,
            on ? "text-foreground font-bold" : "text-muted-foreground font-medium",
          )}
        >
          {c.label}
        </span>
      </button>
    );
  };
  // The chosen pill stays in view: a pick from the menu, or ?row=saved,
  // scrolls the strip to it.
  useEffect(() => {
    // Only when it is out of view, and only the row itself scrolls: on a
    // first load Top is already in view, so the row opens at its start with
    // Menu showing (MESITA-4413; centring it hid Menu and half of Top).
    const row = stripRef.current;
    const on = row?.querySelector<HTMLElement>("[data-on]");
    if (!row || !on) return;
    const left = on.offsetLeft - 8;
    const right = on.offsetLeft + on.offsetWidth + 8 - row.clientWidth;
    if (left < row.scrollLeft) row.scrollTo({ left, behavior: "smooth" });
    else if (right > row.scrollLeft) row.scrollTo({ left: right, behavior: "smooth" });
  }, [chip, tab]);
  const strip = (
    // NO LABEL (Pato, MESITA-4418: "don't mention categories it looks super
    // dirty"): MESITA-4415's "Categories" eyebrow is gone; the circles say it.
    <div className="bg-card border-border flex shrink-0 flex-col border-b pt-2.5 pb-1.5" data-places-strip>
      <nav
        ref={stripRef}
        aria-label="Families"
        className="scrollbar-hide relative flex min-w-0 gap-0.5 overflow-x-auto overscroll-x-contain px-2"
      >
        {/* THE MENU IS THE ROW'S FIRST TILE (MESITA-4410: "i want a menu"):
            a grey round button with its name, the same column as a family,
            opening every family at once. */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close families" : "All families"}
          aria-expanded={menuOpen}
          className={CAT}
          data-places-menu-button
        >
          <span
            aria-hidden
            className={cn(
              CAT_EMOJI,
              menuOpen ? cn(CAT_EMOJI_ON, "text-card") : cn(CAT_EMOJI_OFF, "text-foreground"),
            )}
          >
            {menuOpen ? (
              <X className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
            )}
          </span>
          <span className={cn(CAT_NAME, "text-muted-foreground font-medium")}>Menu</span>
        </button>
        {chips.map((c) => pill(c, false))}
      </nav>
    </div>
  );
  // THE MENU (MESITA-4417): every family as the row's own tiles, four to a
  // line, in a modal over the whole card (CategoriesModal).
  const menu = (
    <CategoriesModal
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      specials={chips.filter((c) => isSpecial(c.key)).map((c) => {
        const on = chip === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              selectFamily(c.key);
              setMenuOpen(false);
            }}
            aria-pressed={on}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-2xl border p-2.5 text-left text-sm font-semibold transition active:scale-[0.98]",
              on ? "bg-foreground text-card border-transparent" : "bg-card text-foreground border-border",
            )}
          >
            <span aria-hidden className={cn(CAT_EMOJI, on ? "bg-card" : CAT_TINT_SPECIAL)}>
              {c.emoji}
            </span>
            {c.label}
          </button>
        );
      })}
    >
      {chips.filter((c) => !isSpecial(c.key)).map((c) => pill(c, true))}
    </CategoriesModal>
  );

  // Home's header (the location alone, MESITA-2405) → the tabs → on Places
  // the family strip over full-width rows (MESITA-4410), on Social the feed;
  // the pane scrolls on its own.
  const shell = (inner: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      {tabs}
      {tab === "places" ? strip : null}
      <div className="relative flex min-h-0 flex-1">
        {tab === "places" ? menu : null}
        {/* ISOLATE: the rows' own z-10 (the offer and Save · Share over the
            card's stretched link, MESITA-3797) stays inside this pane. */}
        <div
          className="bg-card scrollbar-thin-dark isolate flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
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
    <div>
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
