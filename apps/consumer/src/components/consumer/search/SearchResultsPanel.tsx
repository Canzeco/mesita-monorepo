"use client";

// Live text-search results over the map: consumer-suggest-places rows
// grouped "On Mesita" / "From Google". Google-only rows can be generated
// into Mesita on the spot via the Add flow (PredictionRow).

import { Loader2, SearchX } from "lucide-react";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";
import { PredictionRow, type AddState } from "./PredictionRow";

export function SearchResultsPanel({
  query,
  searching,
  searchError,
  predictions,
  addStates,
  resolvePlace,
  onInfo,
  onAdd,
}: {
  query: string;
  searching: boolean;
  searchError: string | null;
  predictions: PlacePrediction[];
  addStates: Record<string, AddState>;
  resolvePlace: (prediction: PlacePrediction) => Place | null;
  onInfo: (prediction: PlacePrediction) => void;
  onAdd: (prediction: PlacePrediction) => void;
}) {
  const onMesita = predictions.filter((p) => p.status !== "not_in_mesita");
  const fromGoogle = predictions.filter((p) => p.status === "not_in_mesita");
  const settled = !searching && query.trim().length >= 2;

  return (
    <div className="border-border bg-background/95 shadow-elev absolute inset-x-3 top-[68px] bottom-3 z-40 overflow-hidden rounded-2xl border backdrop-blur-xl">
      <div className="h-full space-y-3 overflow-y-auto p-3">
        {query.trim().length < 2 && (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">
            Keep typing — at least two letters to search.
          </p>
        )}

        {searching && predictions.length === 0 && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching Mesita and Google…
          </div>
        )}

        {searchError && (
          <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-xs">
            {searchError}
          </p>
        )}

        {settled && !searchError && predictions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-2xl">
              <SearchX className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold">No matches found</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Try the place&apos;s full name, or ask the AI concierge.
            </p>
          </div>
        )}

        {onMesita.length > 0 && (
          <>
            <p className="eyebrow px-1">On Mesita</p>
            {onMesita.map((p) => (
              <PredictionRow
                key={p.placeId}
                prediction={p}
                matchedPlace={resolvePlace(p)}
                addState={addStates[p.placeId]}
                onInfo={onInfo}
                onAdd={onAdd}
              />
            ))}
          </>
        )}

        {fromGoogle.length > 0 && (
          <>
            <p className="eyebrow px-1 pt-1">From Google</p>
            {onMesita.length === 0 && settled && (
              <p className="text-muted-foreground px-1 text-[11px]">
                Not on Mesita yet — tap Add and our Enricher builds the
                profile for everyone.
              </p>
            )}
            {fromGoogle.map((p) => (
              <PredictionRow
                key={p.placeId}
                prediction={p}
                matchedPlace={null}
                addState={addStates[p.placeId]}
                onInfo={onInfo}
                onAdd={onAdd}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
