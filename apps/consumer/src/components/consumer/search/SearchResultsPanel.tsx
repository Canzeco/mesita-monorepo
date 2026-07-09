"use client";

// Live text-search results over the map: consumer-suggest-places rows
// grouped "On Mesita" / "From Google", rendered as plain one-line text rows
// (no thumbnails, no inline buttons). Tapping an On-Mesita row selects the
// place on the map (red pin + rail card — the detail modal is one more tap
// away there); tapping a From-Google row opens the not-on-Mesita preview
// sheet, where the real Add flow lives. The Ask AI chat keeps the richer
// PredictionRow cards — this panel intentionally diverges.

import { BadgeCheck, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/shared";
import type { PlacePrediction } from "@/lib/api/place-search";
import type { AddState } from "./PredictionRow";

export function SearchResultsPanel({
  query,
  searching,
  searchError,
  predictions,
  addStates,
  onPickMesita,
  onPickGoogle,
}: {
  query: string;
  searching: boolean;
  searchError: string | null;
  predictions: PlacePrediction[];
  addStates: Record<string, AddState>;
  onPickMesita: (prediction: PlacePrediction) => void;
  onPickGoogle: (prediction: PlacePrediction) => void;
}) {
  const onMesita = predictions.filter((p) => p.status !== "not_in_mesita");
  const fromGoogle = predictions.filter((p) => p.status === "not_in_mesita");
  const settled = !searching && query.trim().length >= 2;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {query.trim().length < 2 && (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">
            Keep typing — at least two letters to search.
          </p>
        )}

        {searching && predictions.length === 0 && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-xs">
            <Spinner size="sm" label="Searching" />
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
          <div>
            <p className="eyebrow px-1">On Mesita</p>
            <div className="divide-border/60 divide-y">
              {onMesita.map((p) => (
                <SuggestionLine
                  key={p.placeId}
                  prediction={p}
                  source="mesita"
                  addState={addStates[p.placeId]}
                  onPick={onPickMesita}
                />
              ))}
            </div>
          </div>
        )}

        {fromGoogle.length > 0 && (
          <div>
            <p className="eyebrow px-1">From Google</p>
            {onMesita.length === 0 && settled && (
              <p className="text-muted-foreground px-1 pt-1 text-[11px]">
                Not on Mesita yet? Tap a place and we&apos;ll build its profile
                for everyone.
              </p>
            )}
            <div className="divide-border/60 divide-y">
              {fromGoogle.map((p) => (
                <SuggestionLine
                  key={p.placeId}
                  prediction={p}
                  source="google"
                  addState={addStates[p.placeId]}
                  onPick={onPickGoogle}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// One plain text suggestion line — name bold, locality muted, all on a
// single truncating line. The whole row is the tap target; the only chrome
// allowed is the leading source dot (Mesita pink vs Google blue, so the
// eye can tell the sections apart mid-scroll), the Verified badge and the
// "Enriching" pill for rows the consumer just added (their profile is
// still being built, but tapping still opens the preview sheet, which
// explains the state).
function SuggestionLine({
  prediction,
  source,
  addState,
  onPick,
}: {
  prediction: PlacePrediction;
  source: "mesita" | "google";
  addState: AddState | undefined;
  onPick: (prediction: PlacePrediction) => void;
}) {
  const verified =
    prediction.status === "verified_partner_self" ||
    prediction.status === "verified_partner_other";
  const added = addState === "added";

  return (
    <button
      type="button"
      onClick={() => onPick(prediction)}
      className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg px-1 py-2.5 text-left transition"
    >
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          source === "mesita" ? "bg-pink-500" : "bg-blue-500",
        )}
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
      {verified && (
        <BadgeCheck
          className="text-primary h-3.5 w-3.5 shrink-0"
          aria-label="Verified Partner"
        />
      )}
      {added && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <Spinner
            size="sm"
            className="border-emerald-300 border-t-emerald-600"
          />
          Enriching
        </span>
      )}
    </button>
  );
}
