"use client";

import { ChevronDown } from "lucide-react";

import { ALLOWED_RATES } from "./promos";

// Shared chrome for the three-column visit editor. A number is a FLOOR or
// an INCREMENT. Floors render plain ("20%"); increments render signed
// ("+20"); a pinned-zero rung is an em dash — "0%" is a real rate.
//
// Size law: every column is one CSS subgrid. Rate controls are h-9 w-24.
// Knob rows are h-14. Group labels are h-8. Native <select> uses the same
// box as the pinned dash (appearance-none + kit chevron).

export const STRATEGY_COLUMN_TRACKS = 15;

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

/** One labelled row inside a strategy column — always the same height. */
export function BoxRow({
  label,
  emoji,
  hint,
  children,
}: {
  label: string;
  emoji?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 grid h-14 min-h-14 grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="text-foreground truncate type-body font-semibold">
          {emoji ? (
            <span className="mr-1.5" aria-hidden>
              {emoji}
            </span>
          ) : null}
          {label}
        </p>
        <p
          className="text-muted-foreground h-4 truncate type-label leading-4"
          title={hint || undefined}
        >
          {hint || "\u00a0"}
        </p>
      </div>
      <div className="flex h-9 w-24 shrink-0 items-center justify-end">
        {children}
      </div>
    </div>
  );
}

/** Class / Plan / Actions — same cap height in every column. */
export function RowGroup({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground flex h-8 min-h-8 items-end type-meta font-bold tracking-[0.12em] uppercase">
      {children}
    </p>
  );
}
