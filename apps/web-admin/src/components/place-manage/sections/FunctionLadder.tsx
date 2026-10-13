import { creationFlowMark } from "@/lib/state-vocabulary";
import type { CrenupStepRow } from "./state-enrichment";

/**
 * The nine functions, called or not. Create's four (Seed, Details,
 * Description, Embedding) wear a tag so they are not read as enrich-only.
 * Enrich-only rows stay untagged.
 */
export function FunctionLadder({
  rows,
  title,
}: {
  rows: CrenupStepRow[];
  /** Group label. General States uses "Creation"; Enrichment leaves it off. */
  title?: string;
}) {
  return (
    <div className="border-border/60 mt-4 flex flex-col border-t pt-3">
      {title ? (
        <p className="text-muted-foreground type-label pb-1 font-semibold">{title}</p>
      ) : null}
      {rows.map((row) => {
        const mark = creationFlowMark(row.flows);
        // Under the Creation heading, a bare "Create" tag only repeats the
        // group. "Create + Enrich" still earns its place: that function is
        // not creation-only.
        const tag = title === "Creation" && mark === "Create" ? null : mark;
        return (
          <div
            key={row.key}
            className="border-border/60 flex items-center justify-between gap-4 border-b py-3.5 last:border-b-0 last:pb-0"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-foreground/90 type-body font-medium">{row.label}</span>
              {tag ? (
                <span className="text-muted-foreground type-meta inline-flex shrink-0 items-center rounded-full border border-border/70 px-2 py-0.5 font-semibold">
                  {tag}
                </span>
              ) : null}
            </span>
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
        );
      })}
    </div>
  );
}
