"use client";

// Live text-search results over the map: one merged lane (max 10), no
// source section labels. Each row is the Add a place sheet's row
// (MESITA-2931): a mark, the name over its address, and for a Place one
// button — Generate when Google holds it alone (MESITA-2935, was Create
// profile), Open when Mesita does.
// The MARK still tells the two entities apart (MESITA-1404): a Place wears
// the pin, a Location (a city, a region) the map and no button. Tapping a
// row's body anchors the map (MESITA-1405); the button opens or creates.

import { Map as MapIcon, MapPin, RotateCw, SearchX } from "lucide-react";
import { premierLabel } from "@mesita/place-profile";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/shared";
import type { PlacePrediction } from "@/lib/api/place-search";
import { PlaceActionRow } from "./PlaceActionRow";
import {
  locationTypeLabel,
  predictionOnMesita,
  predictionPinTone,
} from "./search-pins";

export function SearchResultsPanel({
  query,
  searching,
  searchError,
  predictions,
  onPick,
  onAction,
  onClearSearch,
  onRetry,
}: {
  query: string;
  searching: boolean;
  searchError: string | null;
  predictions: PlacePrediction[];
  /** The row body: anchor the map (MESITA-1405). */
  onPick: (prediction: PlacePrediction) => void;
  /** The row button: open the profile, or create it first (MESITA-2931). */
  onAction: (prediction: PlacePrediction) => void;
  /** Dismiss the query and hand the map back its catalog rail. */
  onClearSearch?: () => void;
  /** Re-run the same query after a failure. */
  onRetry?: () => void;
}) {
  const settled = !searching && query.trim().length >= 2;

  // THE DEAD "keep typing" BRANCH IS GONE. This panel only mounts while the
  // map is querying (2+ characters, or a search in flight), so a below-minimum
  // prompt could never render — it was left over from the full-page list mode,
  // where the panel was always on screen.
  //
  // EVERY TERMINAL STATE OFFERS A WAY OUT, which the list mode did not have to:
  // there, a dead end still left you on a browsable page. Here the panel is
  // covering the bottom of a map, so an empty or failed search that just sits
  // there is a lid with nothing under it.
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 overflow-y-auto p-3">
        {searching && predictions.length === 0 && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-xs">
            <Spinner size="sm" label="Searching" />
            Searching…
          </div>
        )}

        {searchError && (
          <div className="flex flex-col items-center gap-2 py-1">
            <p className={cn(ERROR_BOX_CLASS, "w-full rounded-xl")}>
              {searchError}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-foreground border-border hover:bg-muted/60 inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition active:scale-[0.98]"
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </button>
            )}
          </div>
        )}

        {settled && !searchError && predictions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <span className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-2xl">
              <SearchX className="h-4 w-4" />
            </span>
            <p className="mt-2.5 text-sm font-semibold">No matches found</p>
            {/* Names the map, because the map is the thing this panel is
                sitting on and the guest can already see it behind us. */}
            <p className="text-muted-foreground mt-1 text-xs">
              Try the full name, or clear the search to browse the map.
            </p>
            {onClearSearch && (
              <button
                type="button"
                onClick={onClearSearch}
                className="text-foreground border-border hover:bg-muted/60 mt-3 inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-semibold transition active:scale-[0.98]"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {predictions.length > 0 && (
          <div className="divide-border divide-y">
            {predictions.map((p) => (
              <SuggestionLine
                key={p.mesitaId ?? p.placeId}
                prediction={p}
                onPick={onPick}
                onAction={onAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionLine({
  prediction,
  onPick,
  onAction,
}: {
  prediction: PlacePrediction;
  onPick: (prediction: PlacePrediction) => void;
  onAction: (prediction: PlacePrediction) => void;
}) {
  const spoken = `${prediction.mainText}${
    prediction.secondaryText ? `, ${prediction.secondaryText}` : ""
  }`;

  // Branch on `kind` BEFORE tone is ever computed: predictionPinTone answers
  // "is this a Premier place", and a Location has no profile to answer
  // for. The accessible label names the ENTITY ("City"), never the absence
  // of a profile.
  if (prediction.kind === "location") {
    return (
      <PlaceActionRow
        mark={
          <MapIcon
            aria-hidden
            className="text-muted-foreground h-5 w-5"
            strokeWidth={2.25}
          />
        }
        title={prediction.mainText}
        subtitle={prediction.secondaryText}
        onRowClick={() => onPick(prediction)}
        rowLabel={`${spoken}, ${locationTypeLabel(prediction.locationType)}`}
      />
    );
  }

  const tone = predictionPinTone(prediction);
  const onMesita = predictionOnMesita(prediction);
  // Three spoken answers over the three tones: a Mesita place that is not
  // Premier has a profile, so it is not "No profile".
  // The word Enriched never reaches a guest (MESITA-2298).
  const toneLabel = tone === "premier"
    ? (premierLabel(prediction.boost_tier ?? prediction.card?.boost_tier) ?? "Mesita Premier")
    : onMesita
      ? "Basic Mesita profile"
      : "No profile yet";

  return (
    <PlaceActionRow
      mark={
        <MapPin
          aria-hidden
          className="text-muted-foreground h-5 w-5"
          strokeWidth={2.25}
        />
      }
      title={prediction.mainText}
      subtitle={prediction.secondaryText}
      onRowClick={() => onPick(prediction)}
      rowLabel={`${spoken}, ${toneLabel}`}
      action={{ onMesita, onClick: () => onAction(prediction) }}
    />
  );
}
