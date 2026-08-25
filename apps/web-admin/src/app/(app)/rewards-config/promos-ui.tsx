"use client";

import { ALLOWED_RATES } from "./promos";

// Shared chrome for the three-box visit editor. The one idea these primitives carry:
// a number on this page is either a FLOOR or an INCREMENT, and the reader must
// never have to guess which. Floors render plain ("20%"); increments render
// signed ("+20"); a pinned-zero rung renders as an em dash, because "0%" is a
// legitimate rate and would read as one.

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
        className="border-border/70 text-muted-foreground bg-muted/50 inline-flex h-9 w-24 items-center justify-center rounded-lg border border-dashed type-body"
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
      className="border-border bg-card focus:border-foreground h-9 w-24 rounded-lg border px-1.5 text-center type-body font-semibold tabular-nums outline-none disabled:opacity-50"
    >
      {ALLOWED_RATES.map((r) => (
        <option key={r} value={r}>
          {r <= 0 ? (signed ? "—" : "Off") : signed ? `+${r}` : `${r}%`}
        </option>
      ))}
    </select>
  );
}

/** One labelled row inside a box. */
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
    <div className="border-border/60 flex items-center justify-between gap-4 border-b py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-foreground type-body font-semibold">
          {emoji ? (
            <span className="mr-1.5" aria-hidden>
              {emoji}
            </span>
          ) : null}
          {label}
        </p>
        {hint ? (
          <p className="text-muted-foreground truncate type-label">{hint}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
