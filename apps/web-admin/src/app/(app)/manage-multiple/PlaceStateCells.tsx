"use client";

// The Place States columns (Main §10, MESITA-3595), shared by the Mesita
// Search table (Manage Multiple) and the Find table (Manage Single) so the
// two pages print the same twelve states the same way Business › Admin's
// Place States card does. Chips are the card's words: Owned · Free · Paid
// up · Connected · On · Signed · 5% … A chip that is on reads green; off is
// plain grey (an Off switch is a choice, not a defect); "?" is a failed read.

import { PLACE_STATE_ROWS } from "@mesita/place-profile/lib/place-states";
import type { PlaceHit } from "./actions";
import { placeStateChips } from "./place-state-cells";

export function PlaceStatePill({ on, chip }: { on: boolean; chip: string }) {
  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 type-label font-semibold whitespace-nowrap " +
        (chip === "?"
          ? "text-muted-foreground bg-muted"
          : on
            ? "bg-green-500/10 text-green-700"
            : "text-muted-foreground bg-muted")
      }
      title={chip === "?" ? "Couldn't read this state" : undefined}
    >
      {chip}
    </span>
  );
}

export function PlaceStateHeads({ className, edgeClassName = "" }: { className: string; edgeClassName?: string }) {
  return (
    <>
      {PLACE_STATE_ROWS.map((r, i) => (
        <th key={r.key} scope="col" className={`${className} ${i === 0 ? edgeClassName : ""}`}>
          {r.label}
        </th>
      ))}
    </>
  );
}

/** One row's twelve cells; `hit` null draws the row's own placeholder. */
export function PlaceStateCells({
  hit,
  className,
  edgeClassName = "",
  empty,
}: {
  hit: PlaceHit | null;
  className: string;
  edgeClassName?: string;
  empty: (label: string) => React.ReactNode;
}) {
  const chips = hit ? placeStateChips(hit) : null;
  return (
    <>
      {PLACE_STATE_ROWS.map((r, i) => (
        <td key={r.key} className={`${className} ${i === 0 ? edgeClassName : ""}`}>
          {chips ? <PlaceStatePill on={chips[r.key].on} chip={chips[r.key].chip} /> : empty(r.label)}
        </td>
      ))}
    </>
  );
}
