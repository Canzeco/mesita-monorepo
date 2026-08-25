"use client";

import { ChevronDown } from "lucide-react";

import { ALLOWED_RATES } from "./promos";

// Shared chrome for the Strategies table. A number is a FLOOR or an
// INCREMENT. Floors render plain ("20%"); increments render signed ("+20");
// a pinned-zero rung is an em dash — "0%" is a real rate.
//
// Rate controls are h-9 w-24. Native <select> uses the same box as the
// pinned dash (appearance-none + kit chevron).

const RATE_BOX =
  "box-border h-9 w-24 rounded-lg border type-body tabular-nums";

/**
 * A rate on the 5% grid. `signed` renders it as an increment (+15) and, when
 * pinned, as an em dash rather than 0% — the visual "+" is what tells a reader
 * this adds to the floor, so `ariaLabel` must carry the word "adds" too:
 * screen readers flatten the glyph away.
 */
export function RateSelect({
  value,
  disabled,
  ariaLabel,
  signed,
  pinned,
  onChange,
}: {
  value: number;
  disabled: boolean;
  ariaLabel: string;
  signed?: boolean;
  pinned?: boolean;
  onChange: (v: number) => void;
}) {
  if (pinned) {
    return (
      <span
        role="presentation"
        title="The baseline rung — it adds nothing by definition"
        className={`${RATE_BOX} border-border/70 text-muted-foreground bg-muted/50 inline-flex items-center justify-center border-dashed`}
      >
        —
      </span>
    );
  }
  return (
    <span className="relative inline-block h-9 w-24 shrink-0">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className={`${RATE_BOX} border-border bg-card focus:border-foreground w-full appearance-none pr-7 pl-1.5 text-center font-semibold outline-none disabled:opacity-50`}
      >
        {ALLOWED_RATES.map((r) => (
          <option key={r} value={r}>
            {r <= 0 ? (signed ? "—" : "Off") : signed ? `+${r}` : `${r}%`}
          </option>
        ))}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2"
        aria-hidden
      />
    </span>
  );
}
