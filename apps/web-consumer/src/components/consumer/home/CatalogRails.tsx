"use client";

// Home — a Temu-style split (Pato, MESITA-2367) under Home's header.
//
//   [⌖ Tecnologico                       ⌄]   Home's header (ModeTabs) is the
//   ┌────────────────┬─────────────────────┐   location alone (MESITA-2405),
//   │ 👥 Social       │                     │   written to
//   │ ❤️ Favorites    │       square        │   lib/active-location.ts and
//   │▌✨ Featured     │        tile         │   read here.
//   │ ──────────────  │                     │
//   │ ☕ Coffee    ↕  │                     │
//
// Left quarter (Pato, MESITA-2411): Social (Soon), Favorites and Featured
// (the default: every place) PINNED above a rule; under it one row per
// family, and only that list scrolls. The chosen row is white, bold, an ink bar on its left edge.
// Featured is the server's ONE ranked Area pool (MESITA-2379/2384): Google
// and Mesita places merged, scored and ranked there; this screen pages it
// (20 tiles at a time, more on scroll) and a family row filters it on each
// place's `area.familyKeys` — the Family gate never moves a score, so the
// order stays the server's and a family change spends nothing. Each
// location's pool is kept ten minutes (lib/area-pool-cache.ts). Favorites
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
import { Compass, Heart, Navigation, Users } from "lucide-react";
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
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics/track";
import { useLocateUser, useUserLocation } from "@/lib/use-user-location";
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
import { HomeSoon } from "./HomeSoon";
import { useActiveLocation } from "@/lib/active-location";
import { cn, errMsg } from "@/lib/utils";
import { placesFeed } from "@/lib/catalog-feed";
import { AreaDiagnostics } from "./AreaDiagnostics";

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
/** Social, Soon (MESITA-2168) — a row since MESITA-2405; it was a Home pill. */
export const SOCIAL_CHIP = "social";

/** The column: Social · Favorites · Featured, a rule, then every guest
 *  family (MESITA-2383, MESITA-2384, MESITA-2411). Everything through
 *  FEATURED_CHIP is pinned; the families after it scroll. Google Places and Mesita Selected are not guest choices
 *  (MESITA-2381): they are the sources Featured mixes. A family with
 *  nothing here says so rather than hiding. */
export function placesChips(): {
  key: string;
  label: string;
  emoji?: string;
  /** Social: not built yet (MESITA-2168). */
  soon?: boolean;
}[] {
  return [
    { key: SOCIAL_CHIP, label: "Social", emoji: "👥", soon: true },
    { key: FAVORITES_CHIP, label: "Favorites", emoji: "❤️" },
    { key: FEATURED_CHIP, label: "Featured", emoji: "✨" },
    ...FILTERABLE_PLACE_FAMILIES.map((f) => ({
      key: f.key as string,
      label: f.label,
      emoji: f.emoji,
    })),
  ];
}

/** Social, Favorites, Featured: the pinned head of the column (MESITA-2411). */
export const PINNED_CHIPS = 3;

/** Tiles drawn per page; the next page appends on scroll (MESITA-2384). */
export const PLACES_PAGE = 20;

/** The places a row shows from the pool, in the server's order. A legacy
 *  rails answer (an Edge Function from before MESITA-2379) is read the way
 *  it always was. */
export function poolPlaces(pool: AreaPool, chip: string): Place[] {
  if (pool.shape === "unified") {
    return chip === FEATURED_CHIP
      ? pool.places
      : pool.places.filter((p) => p.area?.familyKeys.includes(chip));
  }
  const rails = placesFeed(pool.rails);
  return chip === FEATURED_CHIP
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


export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const { savedIds, hydrated, setSaved } = useSavedPlaces();
  const openGooglePlace = useOpenGooglePlace();
  const [pool, setPool] = useState<AreaPool | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // null = the guest's current location; a saved location = search from it.
  const origin = useActiveLocation();
  const from = origin ?? coords;
  const requestKey = areaPoolKey(origin ?? coords);
  // The running load's background reload: the rails on screen stay until
  // the new ones land, and an error never replaces a good feed.
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
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
        const next = await apiListAreaPool(supabase, from);
        if (cancelled || mine !== seq) return;
        if (next.shape === "legacy" && !legacyShapeLogged) {
          legacyShapeLogged = true;
          console.warn("[places] catalog_shape_legacy: the Feed EF answered rails");
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
  // card comes back with its photo and its link, never the emoji stub
  // (MESITA-2307).
  useEffect(
    () =>
      onPlaceCreated(() => {
        clearAreaPools();
        reload.current();
      }),
    [],
  );

  const [chip, setChip] = useState<string>(FEATURED_CHIP);
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
        setPages((p) => ({ key: pageKey, n: (p.key === pageKey ? p.n : 1) + 1 }));
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, pageKey, pageCount]);
  const locate = useLocateUser();

  // Saved previews re-read whenever the saved set changes, so a heart
  // tapped on Featured shows up under Favorites at once.
  const favorites = useMemo(
    () => favoritePlaces(savedIds, readSavedPlacePreviews<Place>()),
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

  // A Soon row reads different (Pato, MESITA-2408): its label muted at rest,
  // a quiet "Soon" under it. The column is a quarter wide, so the tag stacks
  // rather than sitting beside the label.
  const categoryRow = (c: {
    key: string;
    label: string;
    emoji?: string;
    soon?: boolean;
  }) => (
    <li key={c.key}>
      <button
        type="button"
        onClick={() => {
          // The in-Home switch (`nav_tab_tap` is BottomNav's): since
          // MESITA-2409 Home's modes are this column's rows.
          if (chip !== c.key) trackEvent(supabase, "home_mode_view", { mode: c.label });
          setChip(c.key);
        }}
        aria-pressed={chip === c.key}
        className={cn(
          ROW_BASE,
          chip === c.key ? ROW_ON : ROW_OFF,
          c.soon && chip !== c.key && "text-muted-foreground",
        )}
        data-places-soon={c.soon ? "" : undefined}
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
        {c.soon ? (
          <span className="flex min-w-0 flex-col">
            <span className="break-words">{c.label}</span>
            <span className="text-muted-foreground type-meta font-medium tracking-wide uppercase">
              Soon
            </span>
          </span>
        ) : (
          <span className="min-w-0 break-words">{c.label}</span>
        )}
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
      {/* Pinned: Social · Favorites · Featured never scroll (MESITA-2411). */}
      <ul role="list" aria-label="Yours" className="shrink-0" data-places-pinned>
        {chips.slice(0, PINNED_CHIPS).map(categoryRow)}
      </ul>
      <div
        role="separator"
        aria-hidden
        className="border-foreground/15 mx-3 my-1 shrink-0 border-t"
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

  // Social is Soon: the pane says so, nothing loads (MESITA-2168).
  if (chip === SOCIAL_CHIP) {
    return shell(
      <HomeSoon
        icon={Users}
        name="Social"
        description="Seeing where friends go lands here shortly — thanks for waiting."
      />,
    );
  }

  // Favorites never waits on the catalog: the saves are local.
  if (chip === FAVORITES_CHIP) {
    if (!hydrated) {
      return shell(
        <div className={PLACES_LIST}>
          <Skeleton className="aspect-square rounded-md" />
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
        tiles(favorites, "Favorites", false)
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

  if (pool === null) {
    return shell(
      <div className={PLACES_LIST}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>,
    );
  }

  const label = chips.find((c) => c.key === chip)?.label ?? "Places";
  const empty =
    chip === FEATURED_CHIP && from === null ? (
      <EmptyState
        icon={Navigation}
        title="Turn on location"
        description="Places near you show up once Mesita knows where you are."
        action={{ label: "Use my location", onClick: locate }}
      />
    ) : chip === FEATURED_CHIP ? (
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
