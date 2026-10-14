"use client";

// The two glyphs a place's facts are drawn with, shared by the Mesita Search
// table (one row per place) and Single Place (one place, one card) so the
// same fact can never read green on one page and grey on the other.

// falseTone comes from the fact vocabulary (STATE_FACT_FALSE_TONE): rose for
// a pending debt, plain grey for a fact that is merely not true. The taxonomy
// lives in state-vocabulary.ts, so neither page can pick its own.
export function StatePill({
  on,
  falseTone = "pending",
  badWhenTrue = false,
}: {
  on: boolean | "unknown";
  falseTone?: "pending" | "neutral";
  /** For a fact where `true` is the problem (Disabled): rose when true,
   *  green when false. */
  badWhenTrue?: boolean;
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
        (badWhenTrue
          ? on
            ? "bg-rose-500/10 text-rose-700"
            : "bg-green-500/10 text-green-700"
          : on
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
