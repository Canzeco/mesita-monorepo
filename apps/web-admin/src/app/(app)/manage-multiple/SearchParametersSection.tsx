import { ChipRow, FilterCard } from "./SearchFormPrimitives";
import {
  MAX_RESULTS,
  RATING_OPTIONS,
  RESULTS_OPTIONS,
  REVIEW_OPTIONS,
} from "./search-tab-constants";

export function SearchParametersSection({
  maxResults,
  minRating,
  minReviews,
  onMaxResultsChange,
  onMinRatingChange,
  onMinReviewsChange,
}: {
  maxResults: number;
  minRating: number;
  minReviews: number;
  onMaxResultsChange: (value: number) => void;
  onMinRatingChange: (value: number) => void;
  onMinReviewsChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <FilterCard
        label="Results"
        footer="Per query"
        active={maxResults !== MAX_RESULTS}
      >
        <ChipRow
          options={RESULTS_OPTIONS}
          value={maxResults}
          onChange={onMaxResultsChange}
        />
      </FilterCard>
      <FilterCard
        label="Rating"
        footer="Google stars"
        active={minRating > 0}
      >
        <ChipRow
          options={RATING_OPTIONS}
          value={minRating}
          onChange={onMinRatingChange}
        />
      </FilterCard>
      <FilterCard
        label="Reviews"
        footer="Google count"
        active={minReviews > 0}
      >
        <ChipRow
          options={REVIEW_OPTIONS}
          value={minReviews}
          onChange={onMinReviewsChange}
        />
      </FilterCard>
    </div>
  );
}
