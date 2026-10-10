"use client";

import { CRENUP_STEPS } from "@/lib/state-vocabulary";
import type { PlaceHit } from "./actions";
import { crenupCalled } from "./mesita-search-facts";

// The two glyphs a place's facts are drawn with, shared by the Mesita Search
// table (one row per place) and Single Place (one place, one card) so the
// same fact can never read green on one page and grey on the other.

// falseTone comes from the fact vocabulary (STATE_FACT_FALSE_TONE): rose for
// a pending debt, plain grey for a fact that is merely not true. The taxonomy
// lives in state-vocabulary.ts, so neither page can pick its own.
export function StatePill({
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

/** The Crenup ladder for one place: where it stopped, then one chip per step,
 *  green when the function was called (completed OR failed — see
 *  crenupCalled). Renders nothing for a payload that carries no ladder. */
export function CrenupLadder({ hit }: { hit: PlaceHit }) {
  if (hit.enrich_crenup_labels.length === 0) return null;
  return (
    <div>
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
    </div>
  );
}
