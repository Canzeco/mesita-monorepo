import { Loader2, Play, SlidersHorizontal } from "lucide-react";

import { CostCalculator } from "./search-cost";
import {
  MAX_RESULTS,
  MIN_RESULTS,
  RATING_OPTIONS,
  REVIEW_OPTIONS,
} from "./search-tab-constants";
import { ChipRow, FilterCard, ParamCard, StepHeading } from "./SearchFormPrimitives";

export function SearchParametersSection({
  maxResults,
  regionCode,
  minRating,
  minReviews,
  running,
  queriesCount,
  overLimit,
  pagesPerQuery,
  estimatedApiCalls,
  estimatedCostUsd,
  onMaxResultsChange,
  onRegionCodeChange,
  onMinRatingChange,
  onMinReviewsChange,
  onRunSearch,
}: {
  maxResults: number;
  regionCode: string;
  minRating: number;
  minReviews: number;
  running: boolean;
  queriesCount: number;
  overLimit: boolean;
  pagesPerQuery: number;
  estimatedApiCalls: number;
  estimatedCostUsd: number;
  onMaxResultsChange: (value: number) => void;
  onRegionCodeChange: (value: string) => void;
  onMinRatingChange: (value: number) => void;
  onMinReviewsChange: (value: number) => void;
  onRunSearch: () => void;
}) {
  return (
    <>
      <div className="space-y-3">
        <StepHeading
            title="Search settings"
          hint="How many results to pull per query, and which country to bias toward."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ParamCard
            label="Results per query"
            footer={`${MIN_RESULTS}–${MAX_RESULTS} · more = higher cost`}
          >
            <input
              type="number"
              min={MIN_RESULTS}
              max={MAX_RESULTS}
              value={maxResults}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isNaN(n)) return;
                onMaxResultsChange(
                  Math.min(MAX_RESULTS, Math.max(MIN_RESULTS, Math.round(n))),
                );
              }}
              aria-label="Max results per query"
              className="font-display w-full bg-transparent text-center text-5xl font-semibold tracking-tight tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </ParamCard>

          <ParamCard label="Region" footer="ISO-3166-1 alpha-2">
            <input
              value={regionCode}
              onChange={(e) =>
                onRegionCodeChange(
                  e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase(),
                )
              }
              maxLength={2}
              placeholder="MX"
              aria-label="Region code"
              className="font-display block w-full bg-transparent text-center font-mono text-5xl font-semibold tracking-tight uppercase outline-none"
            />
          </ParamCard>
        </div>
      </div>

      <div className="space-y-3">
        <StepHeading
            title="Quality filters"
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          hint="Places with many Google reviews and a high rating are almost always real, good places. Filter out the noise — the results tell you how many each query dropped, so you never mistake a filter for an empty search."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FilterCard
            label="Minimum rating"
            footer="Google star score"
            active={minRating > 0}
          >
            <ChipRow
              options={RATING_OPTIONS}
              value={minRating}
              onChange={onMinRatingChange}
            />
          </FilterCard>
          <FilterCard
            label="Minimum reviews"
            footer="Google review count"
            active={minReviews > 0}
          >
            <ChipRow
              options={REVIEW_OPTIONS}
              value={minReviews}
              onChange={onMinReviewsChange}
            />
          </FilterCard>
        </div>
      </div>

      <CostCalculator
        queries={queriesCount}
        pagesPerQuery={pagesPerQuery}
        totalCalls={estimatedApiCalls}
        totalCostUsd={estimatedCostUsd}
      />

      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={onRunSearch}
          disabled={running || queriesCount === 0 || overLimit}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
          {running ? "Searching…" : "Run search"}
        </button>
      </div>
    </>
  );
}
