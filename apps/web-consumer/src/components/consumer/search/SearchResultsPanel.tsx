"use client";

// Live text-search results over the map: one merged lane (max 10), no
// source section labels. Membership is the leading colored point only —
// gray = Google Places, red = Mesita Places, yellow = Mesita Partners.
// Tapping an on-Mesita row selects the place on the map; tapping a Google-only
// row opens the not-on-Mesita preview sheet.

import { RotateCw, SearchX } from "lucide-react";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/shared";
import type { PlacePrediction } from "@/lib/api/place-search";
import {
  membershipColor,
  membershipTone,
  predictionOnMesita,
} from "@/lib/search-membership";
import type { AddState } from "./add-state";

export function SearchResultsPanel({
  query,
  searching,
  searchError,
  predictions,
  addStates,
  onPickMesita,
  onPickGoogle,
  onClearSearch,
  onRetry,
}: {
  query: string;
  searching: boolean;
  searchError: string | null;
  predictions: PlacePrediction[];
  addStates: Record<string, AddState>;
  onPickMesita: (prediction: PlacePrediction) => void;
  onPickGoogle: (prediction: PlacePrediction) => void;
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
          <div className="divide-border/60 divide-y">
            {predictions.map((p) => (
              <SuggestionLine
                key={p.mesitaId ?? p.placeId}
                prediction={p}
                addState={addStates[p.placeId]}
                onPick={
                  predictionOnMesita(p) ? onPickMesita : onPickGoogle
                }
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
  addState,
  onPick,
}: {
  prediction: PlacePrediction;
  addState: AddState | undefined;
  onPick: (prediction: PlacePrediction) => void;
}) {
  const tone = membershipTone(prediction);
  const added = addState === "added";
  const membershipLabel =
    tone === "partner"
      ? "Partner"
      : tone === "enriched"
        ? "Mesita profile"
        : "No profile yet";

  return (
    <button
      type="button"
      onClick={() => onPick(prediction)}
      aria-label={`${prediction.mainText}${
        prediction.secondaryText ? `, ${prediction.secondaryText}` : ""
      }, ${membershipLabel}`}
      className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg px-1 py-2.5 text-left transition"
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: membershipColor(tone) }}
      />
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="text-foreground font-medium">
          {prediction.mainText}
        </span>
        {prediction.secondaryText && (
          <span className="text-muted-foreground">
            {" "}
            · {prediction.secondaryText}
          </span>
        )}
      </span>
      {added && (
        <span className="type-meta flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
          Added
        </span>
      )}
    </button>
  );
}
