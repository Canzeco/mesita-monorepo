import { EXAMPLE_QUERIES, MAX_QUERIES } from "./search-tab-constants";
import { StepHeading } from "./SearchFormPrimitives";

export function SearchQueriesSection({
  queriesText,
  queriesCount,
  estimatedApiCalls,
  overLimit,
  onQueriesTextChange,
}: {
  queriesText: string;
  queriesCount: number;
  estimatedApiCalls: number;
  overLimit: boolean;
  onQueriesTextChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <StepHeading
        title="Queries"
        hint="One search per line. Duplicates and blank lines are ignored."
      />
      <div className="border-border/60 bg-muted/60 focus-within:border-ring/60 focus-within:ring-ring/10 rounded-xl border transition focus-within:ring-4">
        <div>
          <textarea
            id="queries"
            value={queriesText}
            onChange={(e) => onQueriesTextChange(e.target.value)}
            rows={7}
            placeholder={EXAMPLE_QUERIES.join("\n")}
            spellCheck={false}
            className="placeholder:text-muted-foreground/50 block w-full resize-y rounded-2xl bg-transparent px-5 py-4 font-mono text-sm leading-relaxed outline-none"
          />
          <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs">
            <div className="flex items-center gap-3">
              <span
                className={
                  overLimit
                    ? "text-destructive font-medium"
                    : "text-foreground/70 font-medium"
                }
              >
                {queriesCount} {queriesCount === 1 ? "query" : "queries"}
                {overLimit && ` · over the ${MAX_QUERIES} max`}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>
                ~{estimatedApiCalls} Google API call
                {estimatedApiCalls === 1 ? "" : "s"}
              </span>
              {queriesCount === 0 && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <button
                    type="button"
                    onClick={() => onQueriesTextChange(EXAMPLE_QUERIES.join("\n"))}
                    className="text-secondary hover:text-secondary/80 font-medium underline-offset-2 hover:underline"
                  >
                    Try examples
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
