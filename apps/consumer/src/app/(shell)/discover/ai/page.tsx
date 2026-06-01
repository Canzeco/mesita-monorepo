"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Plus, Search } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiCreateVenueAsConsumer,
  apiSuggestPlaces,
  type PlacePrediction,
} from "@/lib/api/venues";
import { cn, errMsg } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 220;

function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AiPage() {
  const supabase = useBrowserSupabase();
  const sessionTokenRef = useRef(newSessionToken());

  const [showAddVenue, setShowAddVenue] = useState(false);
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlacePrediction | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();

  const trimmed = query.trim();

  useEffect(() => {
    if (!showAddVenue || trimmed.length < 2) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const rows = await apiSuggestPlaces(supabase, trimmed, sessionTokenRef.current);
        if (!cancelled) setPredictions(rows);
      } catch (err) {
        if (!cancelled) {
          setSearchError(errMsg(err, "Search failed."));
          setPredictions([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [showAddVenue, supabase, trimmed]);

  const resetAddVenue = () => {
    setQuery("");
    setPredictions([]);
    setSearching(false);
    setSearchError(null);
    setSelected(null);
    setAddError(null);
    setAddSuccess(null);
    sessionTokenRef.current = newSessionToken();
  };

  const onPick = (prediction: PlacePrediction) => {
    setSelected(prediction);
    setQuery(
      `${prediction.mainText}${prediction.secondaryText ? ` · ${prediction.secondaryText}` : ""}`,
    );
    setPredictions([]);
    setAddError(null);
    setAddSuccess(null);
  };

  const onAddVenue = () => {
    if (!selected || isAdding) return;
    if (selected.status !== "not_in_mesita") {
      setAddError("That place is already on Mesita, so it doesn't need to be added.");
      return;
    }
    setAddError(null);
    setAddSuccess(null);
    startAdd(async () => {
      try {
        const created = await apiCreateVenueAsConsumer(supabase, selected.placeId);
        setAddSuccess(
          `${created.venue.name} is now listed on Mesita and visible to everyone.`,
        );
      } catch (err) {
        setAddError(errMsg(err, "Could not add venue."));
      }
    });
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <div className="bg-peacock shadow-glow flex h-16 w-16 items-center justify-center rounded-full text-2xl">
          🦚
        </div>
        <h1 className="font-display mt-5 text-3xl font-semibold tracking-tight">
          Hola, soy Don Memo,
        </h1>
        <p className="text-foreground/80 mt-1 text-sm font-medium">la IA de Mesita</p>
        <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
          Mientras termina mi modo conversacional, ya puedes buscar lugares y ayudar
          a crecer el mapa agregando venues nuevos.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setShowAddVenue((v) => !v);
              if (showAddVenue) resetAddVenue();
            }}
            className="bg-pink-gradient shadow-glow inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Add a venue
          </button>
          <Link
            href="/discover/search"
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition"
          >
            <Search className="h-4 w-4" />
            Use AI Search
          </Link>
        </div>

        {showAddVenue && (
          <section className="border-border bg-card mt-4 w-full rounded-2xl border p-3 text-left">
            <label className="border-border bg-background focus-within:border-foreground/40 flex items-center gap-2 rounded-full border px-4 py-3 transition">
              <Search className="text-muted-foreground h-4 w-4 shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  setSelected(null);
                  setAddError(null);
                  setAddSuccess(null);
                  if (next.trim().length < 2) {
                    setPredictions([]);
                    setSearching(false);
                    setSearchError(null);
                  }
                }}
                placeholder="Search place by name"
                className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
              />
              {searching && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
            </label>

            {searchError && (
              <p className="bg-destructive/10 text-destructive mt-3 rounded-xl px-3 py-2 text-xs">
                {searchError}
              </p>
            )}

            {predictions.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {predictions.map((p) => (
                  <li key={p.placeId}>
                    <button
                      type="button"
                      onClick={() => onPick(p)}
                      className={cn(
                        "border-border bg-background hover:bg-muted/50 flex w-full flex-col rounded-xl border px-3 py-2 text-left transition",
                        selected?.placeId === p.placeId && "border-secondary",
                      )}
                    >
                      <span className="truncate text-sm font-semibold">{p.mainText}</span>
                      {!!p.secondaryText && (
                        <span className="text-muted-foreground truncate text-[11.5px]">
                          {p.secondaryText}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              disabled={!selected || isAdding || selected.status !== "not_in_mesita"}
              onClick={onAddVenue}
              className="bg-foreground text-background mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding venue...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add selected venue
                </>
              )}
            </button>

            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              The venue is created as unclaimed and becomes visible for all users.
            </p>

            {addError && (
              <p className="bg-destructive/10 text-destructive mt-3 rounded-xl px-3 py-2 text-xs">
                {addError}
              </p>
            )}
            {addSuccess && (
              <p className="bg-secondary/10 text-secondary mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {addSuccess}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
