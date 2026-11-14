"use client";

// The two glyphs a place's facts are drawn with, shared by the Mesita Search
// table (one row per place) and Single Place (one place, one card) so the
// same fact can never read green on one page and grey on the other.

import { Chip, type ChipTone } from "@/components/admin-ui";

// falseTone comes from the fact vocabulary (STATE_FACT_FALSE_TONE): warning for
// a pending debt, plain neutral for a fact that is merely not true. The taxonomy
// lives in state-vocabulary.ts, so neither page can pick its own.
export function StatePill({
  on,
  falseTone = "pending",
  badWhenTrue = false,
}: {
  on: boolean | "unknown";
  falseTone?: "pending" | "neutral";
  /** For a fact where `true` is the problem (Disabled): warning when true,
   *  success when false. */
  badWhenTrue?: boolean;
}) {
  // "?" is its own rendering, not a shade of no: the row is saying it does not
  // know, and a neutral "no" would read as an answer.
  if (on === "unknown") {
    return <Chip title="This payload does not carry that fact">?</Chip>;
  }
  const tone: ChipTone = badWhenTrue
    ? on
      ? "warning"
      : "success"
    : on
      ? "success"
      : falseTone === "neutral"
        ? "neutral"
        : "warning";
  return <Chip tone={tone}>{on ? "yes" : "no"}</Chip>;
}
