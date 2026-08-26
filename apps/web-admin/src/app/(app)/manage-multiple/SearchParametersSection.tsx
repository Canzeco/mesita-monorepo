import Link from "next/link";

import { ChipRow, FilterCard } from "./SearchFormPrimitives";
import { MAX_RESULTS, RESULTS_OPTIONS } from "./search-tab-constants";

export function SearchParametersSection({
  maxResults,
  onMaxResultsChange,
}: {
  maxResults: number;
  onMaxResultsChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
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
      <p className="text-muted-foreground text-xs">
        Google rating and review floors live on{" "}
        <Link
          href="/enricher-config#s-sourcing"
          className="text-foreground underline-offset-2 hover:underline"
        >
          Intake › Sourcing
        </Link>
        .
      </p>
    </div>
  );
}
