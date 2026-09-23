"use client";

import {
  GENERAL_STATE_FACTS,
  CRENUP_STEPS,
  OPERATOR_PROMOTING_LABEL,
  operatorPromotingLevel,
  STATE_FACT_FALSE_TONE,
} from "@/lib/state-vocabulary";
import { STICKY_COL_CELL, STICKY_COL_HEAD } from "@/lib/ui-classes";
import { crenupCalled, factOn, type Row } from "./mesita-search-facts";

export function MesitaSearchResults({ rows }: { rows: Row[] }) {
  return (
    // Bleeds through the card's padding on a phone so the scrollport is
    // the full screen rather than the ~295px left inside it.
    <div className="border-border bg-card -mx-5 mt-6 overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-muted-foreground bg-muted/30 text-left type-label font-semibold tracking-[0.12em] uppercase">
              <th className={`px-4 py-3 font-semibold ${STICKY_COL_HEAD}`}>
                Place
              </th>
              {GENERAL_STATE_FACTS.map((f) => (
                <th key={f.key} className="px-3 py-3 text-center font-semibold">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              // Bind the hit to a const first: narrowing `row.hit` would
              // not survive into the per-fact closures below.
              const hit = row.hit;
              return (
                <tr
                  key={row.key}
                  className="[&>td]:border-border/60 [&>td]:border-t"
                >
                  <td
                    className={`max-w-[60vw] px-4 py-3 sm:max-w-[280px] ${STICKY_COL_CELL}`}
                  >
                    {hit ? (
                      <p className="truncate font-medium">
                        {hit.google_name || hit.name}
                      </p>
                    ) : (
                      <>
                        <p className="text-muted-foreground font-mono text-xs">
                          {row.googleId}
                        </p>
                        <p className="text-muted-foreground type-label">
                          Not on Mesita
                        </p>
                      </>
                    )}
                  </td>
                  {hit
                    ? GENERAL_STATE_FACTS.map((f) => (
                        <td key={f.key} className="px-3 py-3 text-center">
                          {f.key === "promoting" ? (
                            <span className="tabular-nums">
                              {operatorPromotingLevel(hit.promoting_level)}{" "}
                              <span className="text-muted-foreground type-label">
                                {
                                  OPERATOR_PROMOTING_LABEL[
                                    operatorPromotingLevel(hit.promoting_level)
                                  ]
                                }
                              </span>
                            </span>
                          ) : f.key === "requested" ? (
                            <span
                              className={
                                "type-label font-semibold tabular-nums " +
                                (hit.request_count > 0
                                  ? "text-foreground"
                                  : "text-muted-foreground")
                              }
                            >
                              {hit.request_count}
                            </span>
                          ) : (
                            <StatePill
                              on={factOn(hit, f.key)}
                              falseTone={STATE_FACT_FALSE_TONE[f.key]}
                            />
                          )}
                        </td>
                      ))
                    : GENERAL_STATE_FACTS.map((f) => (
                        <td
                          key={f.key}
                          className="text-muted-foreground px-3 py-3 text-center"
                        >
                          —
                        </td>
                      ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.some((r) => r.hit && r.hit.enrich_crenup_labels.length > 0) ? (
        <ul className="border-border divide-border divide-y border-t">
          {rows.map((row) => {
            const hit = row.hit;
            if (!hit || hit.enrich_crenup_labels.length === 0) return null;
            return (
              <li key={`${row.key}-Crenup`} className="px-4 py-3">
                <p className="text-muted-foreground type-label mb-2">
                  Crenup · {hit.google_name || hit.name}
                </p>
                {hit.enrich_crenup_blocked ? (
                  <p className="text-muted-foreground type-label mb-2">
                    Stopped at{" "}
                    {hit.enrich_crenup_labels[hit.enrich_crenup_blocked.index] ??
                      hit.enrich_crenup_blocked.key}{" "}
                    —{" "}
                    {hit.enrich_crenup_blocked.state === "failed"
                      ? "the function ran and failed"
                      : "no event yet"}
                    .
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {CRENUP_STEPS.map((fn) => {
                    const called = crenupCalled(hit, fn);
                    return (
                      <span
                        key={fn.key}
                        className={
                          "rounded-full px-2 py-0.5 type-label font-medium " +
                          (called
                            ? "bg-green-500/10 text-green-700"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {fn.n}. {fn.label}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// falseTone comes from the fact vocabulary (STATE_FACT_FALSE_TONE): rose for
// a pending debt, plain grey for a fact that is merely not true. The taxonomy
// lives in state-vocabulary.ts, so this table cannot pick its own.
function StatePill({
  on,
  falseTone = "pending",
}: {
  on: boolean | "unknown";
  falseTone?: "pending" | "neutral";
}) {
  // "?" is its own rendering, not a shade of no: the row is saying it does not
  // know, and a grey "no" would read as an answer.
  if (on === "unknown") {
    return (
      <span
        title="This payload does not carry that fact"
        className="text-muted-foreground bg-muted inline-flex items-center justify-center rounded-full px-2 py-0.5 type-label font-semibold"
      >
        ?
      </span>
    );
  }
  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 type-label font-semibold " +
        (on
          ? "bg-green-500/10 text-green-700"
          : falseTone === "neutral"
            ? "text-muted-foreground bg-muted"
            : "bg-rose-500/10 text-rose-700")
      }
    >
      {on ? "yes" : "no"}
    </span>
  );
}
