"use client";

// Search — the consumer catalog map. Composition layer for the page:
//
//   • Base: SearchMap fills the body (partner/web pins + user dot).
//   • Top overlay: full-width search bar with a quick chip row + filter sheet
//     while idle. Active chips filter BOTH the catalog rail and the map pins
//     via applyChipFilters. (Ask AI / Memo now lives as a tab on Home.)
//   • Bottom overlay (idle): horizontal catalog rail; tapping a map pin
//     highlights + scrolls to the matching rail card, tapping a card opens
//     the place page.
//   • Typing ≥2 chars runs consumer-suggest-places (debounced, one Google
//     session token per autocomplete session) and swaps in SearchResultsPanel:
//     "On Mesita" rows navigate via placeHref, "From Google" rows expose
//     the real Add flow (consumer-web-create-place creates the place
//     immediately; the async Enricher builds the profile in minutes).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  BadgeCheck,
  ChevronUp,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import type { Place } from "@/lib/api/places";
import {
  apiCreateProject,
  apiSuggestPlaces,
  type PlacePrediction,
} from "@/lib/api/place-search";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { useUserLocation } from "@/lib/use-user-location";
import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";
import { cn, errMsg } from "@/lib/utils";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SearchMap } from "./SearchMap";
import { SearchResultsPanel } from "./SearchResultsPanel";
import type { AddState } from "./PredictionRow";
import {
  CHIP_GROUPS,
  applyChipFilters,
  type ChipTone,
  type FilterChip,
} from "./search-filters";
import {
  formatKm,
  matchPredictionToPlace,
  newSessionToken,
  withDistances,
} from "./search-utils";

// ≥300ms so a fast typist costs one Google autocomplete call per pause,
// not one per keystroke.
const SUGGEST_DEBOUNCE_MS = 300;

export function SearchClient({
  apiKey,
  places,
  fetchError,
}: {
  apiKey: string;
  places: Place[];
  fetchError: string | null;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const userLocation = useUserLocation();
  // Google Places session token. Per Google's session-billing semantics a
  // session spans the keystrokes up to ONE selection — so the token is
  // regenerated after every selection (Info / Add tap) and whenever the
  // results panel is dismissed, scoping each autocomplete run properly.
  const sessionTokenRef = useRef(newSessionToken());
  const railRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const railScrollRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  // Opened by tapping the search field — the results/suggest panel appears on
  // one tap, before any typing.
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 1-based position of the card nearest the rail's scroll start — powers
  // the "3 / 12 places" pager so the horizontal rail reads as browsable.
  const [railIndex, setRailIndex] = useState(0);
  // The bottom rail can be dismissed (X on the counter) to clear the map;
  // it reopens via the floating reopen pill or by tapping any pin.
  const [railCollapsed, setRailCollapsed] = useState(false);

  const trimmed = query.trim();
  // Idle = the map moment: no text query, search panel closed. The chip row
  // and catalog rail only exist here; the results panel owns the other state.
  const idle = trimmed.length === 0 && !searchOpen;

  // Distances ride on the consumer's live location (chip hides until the
  // grant); chips then facet the SAME array the map pins and rail render.
  const catalog = useMemo(
    () => withDistances(places, userLocation),
    [places, userLocation],
  );
  const visible = useMemo(
    () => applyChipFilters(catalog, activeChips),
    [catalog, activeChips],
  );

  // End the current Places autocomplete session and mint the next one.
  const resetSearchSession = useCallback(() => {
    sessionTokenRef.current = newSessionToken();
  }, []);

  // Every query write goes through here so the derived search state stays
  // in the event handler (the set-state-in-effect lint rule bars resetting
  // it inside the effect below): short queries clear the panel, longer
  // ones flag `searching` immediately so the debounce window never
  // flashes the empty state.
  const updateQuery = (next: string) => {
    setQuery(next);
    const nextTrimmed = next.trim();
    if (nextTrimmed.length < 2) {
      // Dropping below the threshold dismisses the results panel — the
      // running autocomplete session is abandoned, so end it here and
      // start the next search on a fresh token.
      if (trimmed.length >= 2) resetSearchSession();
      setPredictions([]);
      setSearching(false);
      setSearchError(null);
    } else if (nextTrimmed !== trimmed) {
      setSearching(true);
    }
  };

  // Debounced live suggest — Mesita + Google merged by the EF.
  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          sessionTokenRef.current,
        );
        if (!cancelled) {
          setPredictions(rows);
          setSearchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPredictions([]);
          setSearchError(errMsg(err, "Search failed — try again."));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [supabase, trimmed]);

  // Predictions carry Google placeIds — the exact-name join only lights up
  // photos/meta decoration; navigation prefers the EF-provided Mesita ids.
  const resolvePlace = useCallback(
    (prediction: PlacePrediction) =>
      matchPredictionToPlace(prediction, catalog),
    [catalog],
  );

  const handleInfo = useCallback(
    (prediction: PlacePrediction) => {
      // Tapping a prediction is the selection that ends a Places session.
      resetSearchSession();
      // When the EF hands back the Mesita identity, navigate directly —
      // no name join, no snapshot dependency.
      const direct = prediction.mesitaSlug ?? prediction.mesitaId;
      if (direct) {
        router.push(placeHref(direct));
        return;
      }
      const match = matchPredictionToPlace(prediction, catalog);
      if (match) {
        router.push(placeHref(match.slug || match.id));
        return;
      }
      // On Mesita per the EF but outside the 200-newest catalog snapshot —
      // be honest about the limitation instead of blaming the place.
      toast(
        "This place is on Mesita but isn't in the map snapshot yet — opening it from search is coming soon.",
      );
    },
    [catalog, resetSearchSession, router],
  );

  // The REAL Add flow: the place is created immediately; only enrichment is
  // scheduled (the cron-driven Enricher pipeline finishes asynchronously),
  // so hold the row in its "added / Enriching" state — nothing further to
  // await client-side.
  const handleAdd = useCallback(
    (prediction: PlacePrediction) => {
      if (addStates[prediction.placeId]) return;
      // Add is also a selection — close out the autocomplete session.
      resetSearchSession();
      setAddStates((s) => ({ ...s, [prediction.placeId]: "adding" }));
      void (async () => {
        try {
          await apiCreateProject(supabase, {
            placeId: prediction.placeId,
          });
          setAddStates((s) => ({ ...s, [prediction.placeId]: "added" }));
          toast.success(
            `${prediction.mainText} is on Mesita — its profile will be ready in a few minutes.`,
          );
        } catch (err) {
          // Roll back so the button is tappable again.
          setAddStates((s) => {
            const next = { ...s };
            delete next[prediction.placeId];
            return next;
          });
          toast.error(errMsg(err, "Couldn't add that place right now."));
        }
      })();
    },
    [addStates, resetSearchSession, supabase],
  );

  // A filter change reshuffles the rail, so snap the pager back to the first
  // card (and the scroll container with it) to keep the count honest.
  const resetRail = () => {
    setRailIndex(0);
    railScrollRef.current?.scrollTo({ left: 0 });
  };

  // Card width (264) + flex gap (8) → the horizontal stride between cards.
  const RAIL_STRIDE = 272;
  const handleRailScroll = () => {
    const el = railScrollRef.current;
    if (!el || visible.length === 0) return;
    // At the far-right end the last card is fully visible but scrollLeft never
    // reaches (n-1)·stride, so Math.round caps one short (shows n-1/n). Snap to
    // the last index once the container is scrolled to its end.
    const overflowing = el.scrollWidth > el.clientWidth;
    const atEnd =
      overflowing && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    const idx = atEnd
      ? visible.length - 1
      : Math.round(el.scrollLeft / RAIL_STRIDE);
    setRailIndex(Math.max(0, Math.min(idx, visible.length - 1)));
  };

  const toggleChip = (id: string) => {
    resetRail();
    setActiveChips((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const clearChips = () => {
    resetRail();
    setActiveChips([]);
  };

  // Pin tap → highlight + scroll the rail to the matching card. Tapping a
  // pin also reopens the rail if it was dismissed. The map pans itself via
  // SearchMap's selectedId.
  const handleSelectPlace = (place: Place) => {
    setRailCollapsed(false);
    setSelectedId(place.id);
    railRefs.current.get(place.id)?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* Base layer — pins reflect the same chip filtering as the rail. */}
      <SearchMap
        apiKey={apiKey}
        places={visible}
        userLocation={userLocation}
        selectedId={selectedId}
        onSelectPlace={handleSelectPlace}
        onOpenPlace={(place) => router.push(placeHref(place.slug || place.id))}
      />

      {/* Floating top overlay — full-width search bar + idle chip row.
          (Ask AI moved to the Home tab's Memo concierge.) */}
      <div className="absolute inset-x-3 top-3 z-30">
        <div className="border-border bg-card shadow-elev flex h-12 items-center gap-1 rounded-full border pr-1.5 pl-4 backdrop-blur-xl">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search places…"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {(query || searchOpen) && (
            <button
              type="button"
              onClick={() => {
                updateQuery("");
                setSearchOpen(false);
              }}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground shrink-0 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {/* Filter now lives inside the bar (reference layout): a hairline
              divider then the tune icon, replacing the standalone chip below. */}
          <span className="bg-border h-6 w-px shrink-0" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filters"
            className="text-foreground hover:text-primary relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeChips.length > 0 && (
              <span className="bg-primary text-primary-foreground absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
                {activeChips.length}
              </span>
            )}
          </button>
        </div>

        {fetchError && idle && (
          <p className="bg-destructive/10 text-destructive mt-2 rounded-xl px-3 py-2 text-xs backdrop-blur">
            {fetchError}
          </p>
        )}

      </div>

      {/* Bottom overlay — horizontal catalog rail (idle only). */}
      {idle && (
        <div className="absolute inset-x-0 bottom-3 z-20">
          {visible.length > 0 ? (
            railCollapsed ? (
              // Dismissed → a single floating pill reopens the rail. Tapping
              // any pin reopens it too (handleSelectPlace).
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setRailCollapsed(false)}
                  className="border-border bg-card/95 text-foreground shadow-elev flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold tabular-nums backdrop-blur transition active:scale-95"
                >
                  <ChevronUp className="text-primary h-4 w-4" />
                  Show {visible.length}{" "}
                  {visible.length === 1 ? "place" : "places"}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-2 flex justify-center">
                  <span className="border-border bg-card/95 text-muted-foreground flex items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-[11px] font-semibold tabular-nums shadow-sm backdrop-blur">
                    <MapPin className="text-primary h-3 w-3" />
                    {visible.length > 1 ? (
                      <>
                        {Math.min(railIndex + 1, visible.length)} /{" "}
                        {visible.length}
                      </>
                    ) : (
                      visible.length
                    )}
                    <span className="text-muted-foreground/70 font-normal">
                      {visible.length === 1 ? "place" : "places"}
                    </span>
                    <span
                      className="bg-border ml-0.5 h-3.5 w-px"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => setRailCollapsed(true)}
                      aria-label="Hide places"
                      className="text-muted-foreground hover:text-foreground flex h-5 w-5 items-center justify-center rounded-full transition active:scale-90"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                <div
                  ref={railScrollRef}
                  onScroll={handleRailScroll}
                  className="scrollbar-hide flex gap-2 overflow-x-auto px-3 pb-1"
                >
                  {visible.map((place) => (
                    <RailCard
                      key={place.id}
                      place={place}
                      selected={place.id === selectedId}
                      onSelect={() => handleSelectPlace(place)}
                      onOpen={() =>
                        router.push(placeHref(place.slug || place.id))
                      }
                      cardRef={(el) => {
                        railRefs.current.set(place.id, el);
                      }}
                    />
                  ))}
                </div>
              </>
            )
          ) : (
            catalog.length > 0 && (
              <div className="border-border bg-card/95 shadow-elev mx-auto flex w-max items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur">
                <p className="text-muted-foreground text-xs">
                  No places match these filters.
                </p>
                <button
                  type="button"
                  onClick={clearChips}
                  className="text-primary text-xs font-semibold"
                >
                  Clear filters
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Typing takes over the map: a full-screen live-results sheet whose solid
          panel covers everything (incl. behind the floating search bar). Sits at
          z-20 below the z-30 bar; pt-[60px] drops results below it. Dismiss via
          the bar's X. */}
      {trimmed.length > 0 && (
        <div className="bg-background absolute inset-0 z-20 flex flex-col pt-[60px]">
          <SearchResultsPanel
            query={query}
            searching={searching}
            searchError={searchError}
            predictions={predictions}
            addStates={addStates}
            resolvePlace={resolvePlace}
            onInfo={handleInfo}
            onAdd={handleAdd}
          />
        </div>
      )}

      {/* Focused but empty → a solid prompt panel over the TOP ~70% only, so the
          live map stays visible in the strip below (the search moment still
          reads as "browse the map"). Sits at z-20 below the z-30 floating
          search bar (which the user types into). */}
      {searchOpen && trimmed.length === 0 && (
        <div className="bg-background border-border absolute inset-x-0 top-0 z-20 flex h-[70%] flex-col items-center justify-center rounded-b-3xl border-b px-8 text-center shadow-sm">
          <span className="text-5xl" role="img" aria-label="Search">
            🔍
          </span>
          <p className="mt-4 text-lg font-semibold">Where to today?</p>
          <p className="text-muted-foreground mt-1.5 max-w-[260px] text-sm">
            Find the perfect place by name or category.
          </p>
        </div>
      )}

      <FiltersSheet
        open={filtersOpen}
        activeIds={activeChips}
        onToggle={toggleChip}
        onClear={clearChips}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}

// Differentiated chip colors per tone (project style bar): brand gradient
// for vibe, emerald for availability, amber for price.
function activeToneClasses(tone: ChipTone): string {
  switch (tone) {
    case "availability":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "price":
      return "border-amber-300 bg-amber-50 text-amber-700";
    default:
      return "bg-pink-gradient border-transparent text-white";
  }
}

// One floating catalog card on the bottom rail.
// Two-step tap: the first tap on an unselected card just selects it (highlight +
// centre the rail/map on it); tapping the already-selected card opens its detail.
function RailCard({
  place,
  selected,
  onSelect,
  onOpen,
  cardRef,
}: {
  place: Place;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  cardRef: (el: HTMLButtonElement | null) => void;
}) {
  const photo = place.photos[0];
  const category = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const subtitle = [category, place.zone].filter(Boolean).join(" · ");
  const hasMeta =
    place.google_rating != null ||
    (place.price_level != null && place.price_level > 0) ||
    place.distance_km != null;

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={selected ? onOpen : onSelect}
      className={cn(
        "border-border bg-card/95 shadow-elev flex w-[288px] shrink-0 items-center gap-3 rounded-2xl border p-2 text-left backdrop-blur transition active:scale-[0.98]",
        selected && "border-primary ring-primary/30 ring-2",
      )}
    >
      <div className="bg-muted border-border relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border">
        {photo ? (
          <Image
            src={photo}
            alt={place.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <span className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
            {place.name[0]?.toUpperCase() ?? "·"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold">{place.name}</span>
          {place.listing_type === "partner" && (
            <BadgeCheck
              className="text-primary h-3.5 w-3.5 shrink-0"
              aria-label="Verified Partner"
            />
          )}
        </span>
        {subtitle && (
          <p className="text-muted-foreground truncate text-[11px]">
            {subtitle}
          </p>
        )}
        {hasMeta && (
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]">
            {place.google_rating != null && (
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                {place.google_rating.toFixed(1)}
              </span>
            )}
            {place.price_level != null && place.price_level > 0 && (
              <span>{"$".repeat(place.price_level)}</span>
            )}
            {place.distance_km != null && (
              <span>{formatKm(place.distance_km)}</span>
            )}
          </p>
        )}
      </div>
    </button>
  );
}

// Bottom-sheet with the full CHIP_GROUPS facets. Kept mounted (toggled via
// `open`, same mechanic as the shared FilterSheet) so the slide transition
// runs and selections survive a close. Chips toggle live; Apply confirms.
function FiltersSheet({
  open,
  activeIds,
  onToggle,
  onClear,
  onClose,
}: {
  open: boolean;
  activeIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const count = activeIds.length;
  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel="Search filters"
      keepMounted
    >
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-base leading-tight font-semibold">
              Filters
            </p>
            <p className="text-muted-foreground text-[11px]">
              Pick any combination
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-xs font-medium transition"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-8 w-8 items-center justify-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-4 pb-2">
        {CHIP_GROUPS.map((group) => (
          <div key={group.key}>
            <p className="eyebrow mb-2">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.chips.map((chip) => (
                <SheetChip
                  key={chip.id}
                  chip={chip}
                  active={activeIds.includes(chip.id)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-border/60 shrink-0 border-t p-4">
        <button
          type="button"
          onClick={onClose}
          className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition active:scale-[0.99]"
        >
          Apply{count > 0 ? ` (${count})` : ""}
        </button>
      </div>
    </LocalSheet>
  );
}

// Chips without a predicate are honest placeholders — the signals don't
// ride on Place yet (see search-filters.ts TODOs) — so they render
// disabled with a "Soon" tag instead of pretending to filter.
function SheetChip({
  chip,
  active,
  onToggle,
}: {
  chip: FilterChip;
  active: boolean;
  onToggle: (id: string) => void;
}) {
  const soon = !chip.match;
  return (
    <button
      type="button"
      disabled={soon}
      onClick={() => onToggle(chip.id)}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition",
        soon
          ? "border-border/60 text-muted-foreground/50 cursor-not-allowed"
          : active
            ? activeToneClasses(chip.tone)
            : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {chip.label}
      {soon && (
        <span className="border-border/70 text-muted-foreground/70 ml-1.5 inline-block rounded-full border px-1.5 py-0.5 align-middle text-[9px] font-medium tracking-[0.14em] uppercase">
          Soon
        </span>
      )}
    </button>
  );
}
