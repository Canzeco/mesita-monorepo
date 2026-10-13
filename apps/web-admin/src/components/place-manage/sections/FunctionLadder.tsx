import type { CrenupStepRow } from "./state-enrichment";

/**
 * Enrichment Steps — one row per Enrich function, called or not.
 * The label already says which step (`1. Details Enriched`).
 */
export function FunctionLadder({ rows }: { rows: CrenupStepRow[] }) {
  return (
    <div className="mt-5 flex flex-col">
      {rows.map((row) => (
        <div
          key={row.key}
          className="border-border/60 flex items-center justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0"
        >
          <span className="text-foreground/90 type-body font-medium">{row.label}</span>
          {/* Three answers since MESITA-1608, and the middle one is why the
              truthiness test had to go: "unknown" is a truthy string, so
              `row.on ? …` would have rendered a place we know NOTHING about
              as done. Absent map (the deploy window, or a payload that
              withholds it) reads "?", never "done" and never "—". */}
          <span
            className={
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 type-label font-semibold " +
              (row.on === "unknown"
                ? "bg-muted text-muted-foreground"
                : "bg-muted text-foreground")
            }
            aria-label={`${row.label}: ${
              row.on === "unknown"
                ? "unknown"
                : row.failed
                  ? "called, and it failed"
                  : row.on
                    ? "called"
                    : "not called"
            }`}
          >
            {row.on === "unknown" ? "?" : row.on ? "done" : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
