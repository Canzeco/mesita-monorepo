"use client";

import { ALLOWED_RATES } from "./promos";

// Shared chrome for the three-box visit editor. The one idea these primitives carry:
// a number on this page is either a FLOOR or an INCREMENT, and the reader must
// never have to guess which. Floors render plain ("20%"); increments render
// signed ("+20"); a pinned-zero rung renders as an em dash, because "0%" is a
// legitimate rate and would read as one.
//
// Rows are a fixed 3.5rem grid so Conservative / Aggressive / Dominant stay
// the same height and every control lines up across columns.

const RATE_CONTROL =
  "inline-flex h-9 w-24 items-center justify-center rounded-lg border type-body tabular-nums";

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
        className={`${RATE_CONTROL} border-border/70 text-muted-foreground bg-muted/50 border-dashed`}
      >
        —
      </span>
    );
  }
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={ariaLabel}
      className={`${RATE_CONTROL} border-border bg-card focus:border-foreground px-1.5 text-center font-semibold outline-none disabled:opacity-50`}
    >
      {ALLOWED_RATES.map((r) => (
        <option key={r} value={r}>
          {r <= 0 ? (signed ? "—" : "Off") : signed ? `+${r}` : `${r}%`}
        </option>
      ))}
    </select>
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
    <div className="border-border/60 grid h-14 grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 border-b last:border-0">
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
          className="text-muted-foreground truncate type-label"
          title={hint || undefined}
        >
          {hint || "\u00a0"}
        </p>
      </div>
      <div className="flex shrink-0 justify-end">{children}</div>
    </div>
  );
}

/** Class / Plan / Actions — same cap height in every column. */
export function RowGroup({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground flex h-8 items-end type-meta font-bold tracking-[0.12em] uppercase">
      {children}
    </p>
  );
}
