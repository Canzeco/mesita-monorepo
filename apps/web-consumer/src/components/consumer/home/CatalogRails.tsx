"use client";

// Places — a Temu-style split (Pato, MESITA-2367; it was a chip row over a
// grid, MESITA-2366).
//
//   ┌──────────┬────────────────────┐
//   │▌Mesita   │                    │   left third: the categories, one per
//   │ Google   │       square       │   row, scrolling on its own; the chosen
//   │ Location │        tile        │   row is white, bold, an ink bar on its
//   │          │                    │   left edge
//   │ ☕ Coffee ├────────────────────┤
//   │ 🥐 Brkfst │       square       │   right two thirds: the chosen set, ONE
//   │  …       │        tile        │   square tile per row, scrolling on its own
//
// Mesita is the Mesita Selected rail, Google the Google Places rail, a family
// row that family's rail — the server's rails unchanged; the row only picks
// which one shows. Favorites is its own Home tab again (MESITA-2368), not a
// row here. Location is not a set: it
// is the location control, and the Google set fills once location is held
// (`useUserLocation` also asks on mount). No search bar. The request sends
// no predicates, so a saved scope can never keep cutting this list.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Compass, Navigation } from "lucide-react";
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
import { cn, errMsg } from "@/lib/utils";
import { placesFeed } from "@/lib/catalog-feed";

/** The server's rail keys for the two sets that lead the chip row. */
export const MESITA_RAIL_KEY = "mesita_selected";
export const GOOGLE_RAIL_KEY = "google_places";

/** One square tile per row, 2px apart (MESITA-2367). */
const PLACES_LIST = "grid grid-cols-1 content-start gap-0.5";

const ROW_BASE =
  "relative flex w-full items-center gap-1.5 px-3 py-3.5 text-left text-sm leading-tight transition";
const ROW_ON = "bg-card text-foreground font-semibold";
const ROW_OFF = "text-foreground hover:bg-card/60";

/** The category column's order: Mesita · Google · (Location) · families. */
export function placesChips(rails: readonly CatalogRail[]): {
  key: string;
  label: string;
  emoji?: string;
}[] {
  const families = rails.filter(
    (r) => r.key !== MESITA_RAIL_KEY && r.key !== GOOGLE_RAIL_KEY,
  );
  return [
    { key: MESITA_RAIL_KEY, label: "Mesita" },
    { key: GOOGLE_RAIL_KEY, label: "Google" },
    ...families.map((r) => ({
      key: r.key,
      label: r.label,
      emoji: r.emoji && r.emoji !== "·" ? r.emoji : undefined,
    })),
  ];
}

export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const { savedIds, setSaved } = useSavedPlaces();
  const openGooglePlace = useOpenGooglePlace();
  const [rails, setRails] = useState<CatalogRail[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const requestKey =
    coords === null ? "" : `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
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
        const next = await apiListCatalog(supabase, coords);
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
  const [chip, setChip] = useState<string>(MESITA_RAIL_KEY);
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
  const categories = (
    <nav
      className="bg-muted scrollbar-hide w-1/3 shrink-0 overflow-y-auto overscroll-y-contain"
      aria-label="Places"
      data-places-categories
    >
      <ul role="list">
        {chips.slice(0, 2).map(categoryRow)}
        <li>
          <button
            type="button"
            onClick={locate}
            disabled={coords !== null || locating}
            className={cn(
              ROW_BASE,
              coords !== null ? "text-muted-foreground" : "text-foreground",
            )}
          >
            <Navigation className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            {coords !== null ? "Near you" : locating ? "Locating…" : "Location"}
          </button>
        </li>
        {chips.slice(2).map(categoryRow)}
      </ul>
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
    shownRails.find((r) => r.key === chip)?.places ?? [];

  const empty =
    chip === GOOGLE_RAIL_KEY && coords === null ? (
      <EmptyState
        icon={Navigation}
        title="Turn on location"
        description="Google places near you show up once Mesita knows where you are."
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
