"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared";
import { apiSuggestPlaces, type PlacePrediction } from "@/lib/api/place-search";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

import { PlaceActionRow } from "./PlaceActionRow";
import { predictionOnMesita } from "./search-pins";
import { newSessionToken } from "./search-utils";

// ADD A PLACE (Pato, MESITA-2902: "open a new modal and write a searchbar of
// the place to add, and actually show the results … and click the create new
// profile"). The carousel's Add card opens this sheet — Home's location
// picker pattern (LocalSheet): a focused field, Google's names (`deep`:
// Autocomplete + Text Search, MESITA-2896), and one button a row. A place
// not on Mesita says Generate: the Generate dialog confirms, calls
// consumer-web-create-place (get-or-create, MESITA-2298) and opens the
// profile. A place Mesita already holds says Open. Areas
// (Locations) are not places, so they never list here. Generate (was Create
// profile) asks first in SearchClient's Generate dialog (MESITA-2935).

const MIN_QUERY = 2;
const SEARCH_DELAY_MS = 400;

export function AddPlaceSheet({
  open,
  onClose,
  origin,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  /** Biases Google to where the guest is looking (the map's camera). */
  origin: { lat: number; lng: number };
  /** Create (Google-only row) or open (Mesita row): SearchClient's
   *  explicit open, which owns get-or-create. */
  onPick: (prediction: PlacePrediction) => void;
}) {
  const supabase = useBrowserSupabase();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(newSessionToken());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const originRef = useRef(origin);
  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  // The field takes the keyboard as the sheet rises.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 320);
    return () => window.clearTimeout(t);
  }, [open]);

  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          tokenRef.current,
          originRef.current,
          "deep",
        );
        if (cancelled) return;
        setResults(rows.filter((r) => r.kind !== "location"));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setResults([]);
        setError(errMsg(err, "Couldn't search Google right now."));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [supabase, trimmed]);

  const change = (next: string) => {
    setQuery(next);
    if (next.trim().length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      setError(null);
    } else if (next.trim() !== trimmed) {
      setSearching(true);
    }
  };

  const close = () => {
    setQuery("");
    setResults([]);
    setSearching(false);
    setError(null);
    // A new Google billing session for the next search.
    tokenRef.current = newSessionToken();
    onClose();
  };

  const pick = (row: PlacePrediction) => {
    onPick(row);
    close();
  };

  const typing = trimmed.length >= MIN_QUERY;

  return (
    <LocalSheet open={open} onClose={close} ariaLabel="Add a place">
      <div className={SHEET_BODY_CLASS} data-search-add-sheet>
        <h2 className={SHEET_TITLE_CLASS}>Add a place</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Find it on Google. If it isn&apos;t on Mesita yet, generate its profile.
        </p>
        <label className="relative mt-4 block">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => change(e.target.value)}
            placeholder="Search a restaurant, café, bar…"
            aria-label="Search a place to add"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className={cn(INPUT_CLASS, "pr-10 pl-9")}
            data-search-add-input
          />
          {query ? (
            <button
              type="button"
              onClick={() => change("")}
              aria-label="Clear"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </label>

        {error ? <p className={cn(ERROR_BOX_CLASS, "mt-3")}>{error}</p> : null}

        {typing ? (
          <ul
            role="list"
            aria-label="Places on Google"
            aria-busy={searching}
            className="divide-border mt-2 divide-y"
            data-search-add-results
          >
            {results.map((row) => {
              const onMesita = predictionOnMesita(row);
              return (
                <li key={row.mesitaId ?? row.placeId}>
                  <PlaceActionRow
                    mark={
                      <MapPin
                        className="text-muted-foreground h-5 w-5"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    }
                    title={row.mainText}
                    subtitle={row.secondaryText}
                    action={{ onMesita, onClick: () => pick(row) }}
                  />
                </li>
              );
            })}
            {results.length === 0 ? (
              <li className="text-muted-foreground flex items-center gap-2 py-3 text-sm">
                {searching ? (
                  <>
                    <Spinner size="sm" label="Searching Google" />
                    Searching Google…
                  </>
                ) : error ? null : (
                  "No places on Google match that."
                )}
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-4 text-sm">
            Type at least two letters.
          </p>
        )}
      </div>
    </LocalSheet>
  );
}
