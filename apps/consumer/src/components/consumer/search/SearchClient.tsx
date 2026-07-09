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
//     plain one-line text rows. "On Mesita" rows select the place on the map
//     (red pin + rail card; the detail modal is one more tap away there),
//     "From Google" rows open GooglePlaceSheet — a not-on-Mesita preview
//     carrying the real Add flow (consumer-web-create-place creates the
//     place immediately; the async Enricher builds the profile in minutes).

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
import { getOpeningStatusLabel } from "@/lib/place-status";
import { useUserLocation } from "@/lib/use-user-location";
import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";
import { cn, errMsg } from "@/lib/utils";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { FiltersComingSoon } from "@/components/consumer/FiltersComingSoon";
import { SearchMap } from "./SearchMap";
import { SearchResultsPanel } from "./SearchResultsPanel";
import { GooglePlaceSheet } from "./GooglePlaceSheet";
import type { AddState } from "./PredictionRow";
// CHIP_GROUPS / ChipTone / FilterChip dropped with the parked filter chips;
// applyChipFilters stays (no-op with the now always-empty activeChips) so the
// map/rail pipeline is untouched and un-parking is a localized restore.
import { applyChipFilters } from "./search-filters";
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
  // From-Google preview sheet. `preview` survives the close (only `open`
  // flips) so the exit transition doesn't blank the panel mid-slide.
  const [preview, setPreview] = useState<PlacePrediction | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const visible = useMemo(() => {
    const filtered = applyChipFilters(catalog, activeChips);
    // The selection must stay pinned even when the active chips would
    // filter it out (a search pick lands here regardless of chips) —
    // otherwise the red dot the user just asked for silently disappears.
    if (selectedId && !filtered.some((p) => p.id === selectedId)) {
      const held = catalog.find((p) => p.id === selectedId);
      if (held) return [held, ...filtered];
    }
    return filtered;
  }, [catalog, activeChips, selectedId]);

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

  // On-Mesita row tap → show the place on the map (red selected pin + rail
  // card) instead of opening the detail modal; the modal is one more tap
  // away on the pin or the card. The EF-provided Mesita id is the primary
  // join; the exact-name match covers older suggest payloads.
  const handlePickMesita = (prediction: PlacePrediction) => {
    const match =
      (prediction.mesitaId
        ? catalog.find((p) => p.id === prediction.mesitaId)
        : null) ?? matchPredictionToPlace(prediction, catalog);
    if (match) {
      // Clearing the query is the selection that ends the Places session
      // (updateQuery mints the next token) and hands back the idle map.
      updateQuery("");
      setSearchOpen(false);
      setRailCollapsed(false);
      setSelectedId(match.id);
      return;
    }
    // On Mesita per the EF but outside the mappable catalog snapshot — no
    // coordinates to pin, so fall back to opening the detail modal directly.
    resetSearchSession();
    const direct = prediction.mesitaSlug ?? prediction.mesitaId;
    if (direct) {
      router.push(placeHref(direct));
      return;
    }
    toast(
      "This place is on Mesita but isn't in the map snapshot yet — opening it from search is coming soon.",
    );
  };

  // From-Google row tap → the not-on-Mesita preview sheet (the Add flow
  // lives there now). Tapping a row is the selection that ends the current
  // Places autocomplete session.
  const handlePickGoogle = (prediction: PlacePrediction) => {
    resetSearchSession();
    setPreview(prediction);
    setPreviewOpen(true);
  };

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
            `${prediction.mainText} is on Mesita — our AI generates its profile in about 5 minutes.`,
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

  // toggleChip removed with the parked filter chips (FiltersSheet is soon).
  // clearChips stays: the "No places match" rail escape hatch still calls it.
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
  };

  // Center the rail card for the selected place once the rail is on screen.
  // An effect (not the tap handlers) because a search pick mounts the rail
  // on the SAME commit that sets the selection — the card ref only exists
  // after that render; it also re-centers when a dismissed rail reopens.
  useEffect(() => {
    if (!idle || railCollapsed || !selectedId) return;
    railRefs.current.get(selectedId)?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [idle, railCollapsed, selectedId]);

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
        // Tapping the map canvas is a second way into search (besides the
        // bar) — the panel opens over the top while the map stays visible.
        onMapClick={() => setSearchOpen(true)}
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

      {/* Typing swaps in live results over the TOP ~70% — same footprint as the
          empty "Where to today?" panel so the search field never jumps and the
          live map stays visible in the strip below. Sits at z-20 below the z-30
          floating bar; pt-[60px] drops results below it. Dismiss via the bar's X. */}
      {trimmed.length > 0 && (
        <div className="bg-background border-border absolute inset-x-0 top-0 z-20 flex h-[70%] flex-col rounded-b-3xl border-b pt-[60px] shadow-sm">
          <SearchResultsPanel
            query={query}
            searching={searching}
            searchError={searchError}
            predictions={predictions}
            addStates={addStates}
            onPickMesita={handlePickMesita}
            onPickGoogle={handlePickGoogle}
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
        onClose={() => setFiltersOpen(false)}
      />

      <GooglePlaceSheet
        open={previewOpen}
        prediction={preview}
        addState={preview ? addStates[preview.placeId] : undefined}
        apiKey={apiKey}
        onAdd={handleAdd}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
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
  const openingLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;
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
        {openingLabel && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isOpen ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            <span
              className={cn(
                "truncate",
                isOpen ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {openingLabel}
            </span>
          </span>
        )}
      </div>
    </button>
  );
}

// PARKED (soon): the trigger still opens this sheet, but it shows a single
// coming-soon state instead of the Vibe / Availability / Price chips while we
// finish the real filtering backend. The full chip body + SheetChip live in
// this file's git history — to un-park, restore them (and re-wire
// activeIds/onToggle/onClear) and drop FiltersComingSoon. Props kept minimal so
// SearchClient's call site stays stable.
function FiltersSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Search filters">
      <FiltersComingSoon onClose={onClose} />
    </LocalSheet>
  );
}
