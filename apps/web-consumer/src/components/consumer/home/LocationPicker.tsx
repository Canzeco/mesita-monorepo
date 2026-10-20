"use client";

// Home's location control — the whole of Home's header (Pato, MESITA-2405:
// "The top bar is just to select the location. thats it."): one centred
// oval hugging a pin, the active location's name and a quiet chevron
// (MESITA-2459: "inside a … oval … it must indicate change"). It wears
// Search's pill token (HEADER_PILL), so both tabs' header controls match.
// History: a full-width bordered bar (MESITA-2405), a chip row with discs
// (MESITA-2452..2454), a borderless line (MESITA-2456).
// A tap opens the location sheet (MESITA-2464: "the direct search bar of
// locations"): a search field on top, then Current location and the guest's
// saved locations (each removable). Typing swaps that list for matches; a
// tap resolves the match (a region saves an AREA, anything else a POINT,
// lib/location-pick.ts), keeps it under its Google name, makes it the active
// location and closes: one step, no naming screen (the separate Add location
// sheet of MESITA-2380 is gone). The choice lives in `lib/active-location.ts`,
// which Home's catalog reads.

import { useEffect, useState, type ReactNode } from "react";
import {
  Bookmark,
  ChevronDown,
  Loader2,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { apiSuggestPlaces, type PlacePrediction } from "@/lib/api/place-search";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useHereName } from "@/lib/use-here-name";
import { newSessionToken } from "@/components/consumer/search/search-utils";
import { resolveLocationPick } from "@/lib/location-pick";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import {
  addSavedLocation,
  removeSavedLocation,
  useSavedLocations,
  type SavedLocation,
} from "@/lib/saved-locations";
import { setActiveLocation, useActiveLocation } from "@/lib/active-location";
import { cn, errMsg } from "@/lib/utils";
import { HEADER_PILL } from "@/components/consumer/search/header-classes";

/** What the pill says: the saved name, or the state of the device fix. The
 *  sheet's row adds the neighbourhood once known (MESITA-2466): "Current
 *  location · Distrito Tec"; the header oval never passes one. */
export function locationLabel(
  active: { name: string } | null,
  hasFix: boolean,
  locating: boolean,
  hereName: string | null = null,
): string {
  if (active) return active.name;
  if (hasFix) return hereName ? `Current location · ${hereName}` : "Current location";
  return locating ? "Locating…" : "Use my location";
}

const ICON = "h-4 w-4 shrink-0";

/** A saved location as the active one. */
function activeFrom(l: SavedLocation) {
  return {
    key: `saved:${l.id}`,
    name: l.name,
    lat: l.lat,
    lng: l.lng,
    bounds: l.bounds,
  };
}

export function LocationPicker() {
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
  const active = useActiveLocation();
  const savedLocations = useSavedLocations();
  const supabase = useBrowserSupabase();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Google bills Autocomplete per session: one token until a pick or close.
  const [token, setToken] = useState(newSessionToken);
  const label = locationLabel(active, coords !== null, locating);
  // Asked only while the sheet is open, once per ~110 m (MESITA-2466).
  const hereName = useHereName(coords, picking);
  const typing = query.trim().length >= 2;

  // Search after a short pause; the newest query wins.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await apiSuggestPlaces(supabase, q, token, coords);
        if (!cancelled) {
          setResults(rows.slice(0, 8));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(errMsg(err, "Couldn't search right now."));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // `coords` only biases the ranking; a new fix should not re-run a search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, query]);

  const close = () => {
    setPicking(false);
    setQuery("");
    setResults([]);
    setError(null);
    setResolving(null);
    setToken(newSessionToken());
  };

  const pick = async (r: PlacePrediction) => {
    setError(null);
    setResolving(r.placeId);
    try {
      const loc = addSavedLocation(await resolveLocationPick(supabase, r));
      setActiveLocation(activeFrom(loc));
      close();
    } catch (err) {
      setError(errMsg(err, "Couldn't open that location right now."));
    } finally {
      setResolving(null);
      // Google bills a session per pick; the next search starts a new one.
      setToken(newSessionToken());
    }
  };

  const row = (r: {
    key: string;
    label: string;
    icon: ReactNode;
    selected: boolean;
    onClick: () => void;
    muted?: boolean;
    onRemove?: () => void;
  }) => (
    <li key={r.key} className="relative">
      <button
        type="button"
        onClick={r.onClick}
        aria-pressed={r.selected}
        className={cn(
          "flex w-full items-center gap-3 py-3.5 pr-10 text-left text-sm transition",
          r.selected ? "font-semibold" : "hover:bg-muted",
          r.muted && !r.selected && "text-muted-foreground",
        )}
      >
        {r.icon}
        <span className="min-w-0 truncate">{r.label}</span>
      </button>
      {r.onRemove ? (
        <button
          type="button"
          onClick={r.onRemove}
          aria-label={`Remove ${r.label}`}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
          data-places-remove-location
        >
          <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </li>
  );

  return (
    <>
      {/* The header's right side: the location oval, beside the logo (MESITA-2405, MESITA-2459, MESITA-2470). */}
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-haspopup="dialog"
        aria-label={`Location: ${label}. Change location`}
        className={cn(HEADER_PILL, "ml-auto max-w-full min-w-0 justify-center")}
        data-home-location
      >
        {/* One oval, right-aligned and sized to its content: pin, name, chevron
            (MESITA-2459). No discs; the name truncates. */}
        <MapPin className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0"
          strokeWidth={2}
          aria-hidden
        />
      </button>

      <LocalSheet open={picking} onClose={close} ariaLabel="Location">
        <div className={SHEET_BODY_CLASS} data-places-location-sheet>
          <h2 className={SHEET_TITLE_CLASS}>Location</h2>
          <label className="relative mt-3 block">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) setResults([]);
              }}
              placeholder="Search a city, neighborhood or address"
              aria-label="Search a location"
              enterKeyHint="search"
              autoComplete="off"
              className={cn(INPUT_CLASS, "pl-9")}
              data-places-location-search
            />
          </label>
          {error ? <p className={cn(ERROR_BOX_CLASS, "mt-3")}>{error}</p> : null}

          {typing ? (
            <ul
              role="list"
              aria-label="Matches"
              className="divide-border mt-2 divide-y"
              data-places-location-results
            >
              {results.map((r) => (
                <li key={r.placeId}>
                  <button
                    type="button"
                    disabled={resolving !== null}
                    onClick={() => void pick(r)}
                    className="hover:bg-muted flex w-full items-center gap-3 py-3 text-left transition"
                  >
                    {resolving === r.placeId ? (
                      <Loader2 className={cn(ICON, "animate-spin")} aria-hidden />
                    ) : (
                      <MapPin className={ICON} strokeWidth={2.25} aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {r.mainText}
                      </span>
                      {r.secondaryText ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {r.secondaryText}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 ? (
                <li className="text-muted-foreground py-3 text-xs">
                  {searching ? "Searching…" : "No matches yet"}
                </li>
              ) : null}
            </ul>
          ) : (
          <ul
            role="list"
            aria-label="Location"
            className="divide-border mt-2 divide-y"
            data-places-location
          >
            {row({
              key: "here",
              label: locationLabel(null, coords !== null, locating, hereName),
              icon: (
                <Navigation className={ICON} strokeWidth={2.25} aria-hidden />
              ),
              selected: active === null && coords !== null,
              muted: coords === null,
              onClick: () => {
                setActiveLocation(null);
                if (coords === null) locate();
                close();
              },
            })}
            {savedLocations.map((l) =>
              row({
                key: `saved:${l.id}`,
                label: l.name,
                icon: (
                  <Bookmark className={ICON} strokeWidth={2.25} aria-hidden />
                ),
                selected: active?.key === `saved:${l.id}`,
                onClick: () => {
                  setActiveLocation(activeFrom(l));
                  close();
                },
                // Removing the active location falls back to Current location.
                onRemove: () => {
                  removeSavedLocation(l.id);
                  if (active?.key === `saved:${l.id}`) setActiveLocation(null);
                },
              }),
            )}
          </ul>
          )}
        </div>
      </LocalSheet>
    </>
  );
}
