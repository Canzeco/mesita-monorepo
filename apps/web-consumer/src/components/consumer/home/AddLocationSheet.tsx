"use client";

// Add location (Pato, MESITA-2380): find a place or area by name — or take
// where the guest stands — then name it (Home, Office…) and save. The saved
// point appears in Places' Location group and Places searches from it.
//
// Search rides Word's lane (consumer-web-suggest-places, fast Autocomplete):
// a Location row has no coordinates until one anchor resolve on pick; a
// place row may already carry them. A REGION pick (a city, a neighbourhood,
// a postcode) whose anchor has a viewport saves an AREA with that rectangle;
// a place, a street address or "where I stand" saves a POINT (MESITA-2383).

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  apiResolveLocationAnchor,
  apiSuggestPlaces,
  type PlacePrediction,
} from "@/lib/api/place-search";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  addSavedLocation,
  type LocationBounds,
  type SavedLocation,
} from "@/lib/saved-locations";
import { newSessionToken } from "@/components/consumer/search/search-utils";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

type Picked = {
  name: string;
  lat: number;
  lng: number;
  bounds?: LocationBounds | null;
};

/** Google types that name a region, not a spot (MESITA-2383). */
const REGION_TYPE = /^(locality|sublocality(_level_\d)?|neighborhood|colloquial_area|administrative_area_level_\d|postal_code)$/;

/** True when the pick is a region and should save as an area. */
export function isRegionPick(row: Pick<PlacePrediction, "kind" | "locationType">): boolean {
  return row.kind === "location" && REGION_TYPE.test(row.locationType ?? "");
}

const RESULT_ROW =
  "hover:bg-muted flex w-full items-center gap-3 px-1 py-3 text-left transition";

export function AddLocationSheet({
  open,
  onClose,
  here,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** The guest's current position, when known: "Save where I am". */
  here: { lat: number; lng: number } | null;
  onSaved: (loc: SavedLocation) => void;
}) {
  const supabase = useBrowserSupabase();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const token = useRef(newSessionToken());

  // Search after a short pause; the newest query wins.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await apiSuggestPlaces(supabase, q, token.current, here);
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
    // `here` only biases the ranking; a new fix should not re-run a search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, query]);

  const close = () => {
    setQuery("");
    setResults([]);
    setPicked(null);
    setName("");
    setError(null);
    setResolving(null);
    token.current = newSessionToken();
    onClose();
  };

  const pick = async (row: PlacePrediction) => {
    setError(null);
    if (typeof row.lat === "number" && typeof row.lng === "number") {
      setPicked({ name: row.mainText, lat: row.lat, lng: row.lng });
      setName(row.mainText);
      return;
    }
    setResolving(row.placeId);
    try {
      const anchor = await apiResolveLocationAnchor(supabase, row.placeId);
      setPicked({
        name: row.mainText,
        lat: anchor.lat,
        lng: anchor.lng,
        bounds: isRegionPick(row) ? anchor.viewport : null,
      });
      setName(row.mainText);
    } catch (err) {
      setError(errMsg(err, "Couldn't open that location right now."));
    } finally {
      setResolving(null);
      // Google bills a session per pick; the next search starts a new one.
      token.current = newSessionToken();
    }
  };

  const save = () => {
    if (!picked) return;
    const loc = addSavedLocation({ ...picked, name: name || picked.name });
    onSaved(loc);
    close();
  };

  return (
    <LocalSheet open={open} onClose={close} ariaLabel="Add location">
      <div className={SHEET_BODY_CLASS} data-add-location-sheet>
        <h2 className={SHEET_TITLE_CLASS}>
          {picked ? "Name this location" : "Add location"}
        </h2>

        {picked ? (
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{picked.name}</span>
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Home, Office…"
              maxLength={40}
              autoFocus
              aria-label="Location name"
              className={INPUT_CLASS}
            />
            <button
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!name.trim()}
              data-add-location-save
            >
              Save location
            </button>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-muted-foreground py-2 text-xs font-semibold"
            >
              Pick another place
            </button>
          </form>
        ) : (
          <>
            <label className="relative mt-4 block">
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
                placeholder="Search a neighborhood, street or place"
                aria-label="Search a location"
                className={cn(INPUT_CLASS, "pl-9")}
                autoFocus
              />
            </label>

            {error ? <p className={cn(ERROR_BOX_CLASS, "mt-3")}>{error}</p> : null}

            <ul role="list" className="divide-border mt-2 divide-y">
              {here ? (
                <li>
                  <button
                    type="button"
                    className={RESULT_ROW}
                    onClick={() => {
                      setPicked({ name: "Where I am now", ...here });
                      setName("");
                    }}
                    data-add-location-here
                  >
                    <Navigation className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-sm font-semibold">Save where I am</span>
                  </button>
                </li>
              ) : null}
              {results.map((row) => (
                <li key={row.placeId}>
                  <button
                    type="button"
                    className={RESULT_ROW}
                    disabled={resolving !== null}
                    onClick={() => void pick(row)}
                  >
                    {resolving === row.placeId ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {row.mainText}
                      </span>
                      {row.secondaryText ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {row.secondaryText}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {searching && results.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-xs">Searching…</p>
            ) : null}
          </>
        )}
      </div>
    </LocalSheet>
  );
}
