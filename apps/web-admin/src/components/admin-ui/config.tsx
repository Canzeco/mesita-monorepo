"use client";

import { CheckCircle2 } from "lucide-react";
import { Button as Button } from "./button";
import { Chip } from "./chip";
import { cn } from "./cn";
import { INPUT_FRAME_CLASS } from "./ui/input";

// Config logic — `@/components/admin-ui/config`. The chrome lives in the kit
// (`@/components/admin-ui`); this file keeps only what is config-specific:
// KnobState, SaveRow, QueryConcatCaps.

// Per-knob enforcement state (MESITA-738). The console is the operator's model
// of the product, so a control that persists but changes nothing has to SAY so
// next to itself. Three honest states:
//
//   enforced  — a live consumer reads this value; changing it changes behavior
//   fallback  — read only when a higher-precedence source is unset
//   not-wired — persisted, but no consumer reads it yet
//
// Keep the reason one clause and name the reader (or the thing that wins), so
// the claim is checkable against the code rather than taken on faith.
type KnobEnforcement = "enforced" | "fallback" | "not-wired";

const KNOB_STATE: Record<
  KnobEnforcement,
  { label: string; tone: "neutral" | "warning"; dot: boolean }
> = {
  enforced: { label: "Enforced", tone: "neutral", dot: true },
  fallback: { label: "Fallback", tone: "warning", dot: false },
  "not-wired": { label: "Not wired", tone: "neutral", dot: false },
};

export function KnobState({ kind, reason }: { kind: KnobEnforcement; reason: string }) {
  const s = KNOB_STATE[kind];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Chip tone={s.tone} dot={s.dot}>
        {s.label}
      </Chip>
      <span className="text-muted-foreground type-label font-normal">{reason}</span>
    </span>
  );
}

export type QueryCapRung = {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  /** Per-rung ceiling. Falls back to the control `max`. */
  max?: number;
};

function QueryCapRow({
  rung,
  min,
  max,
  disabled,
}: {
  rung: QueryCapRung;
  min: number;
  max: number;
  disabled: boolean;
}) {
  const cap = rung.max ?? max;
  return (
    <label className="border-border bg-background flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium leading-snug">
        {rung.icon}
        {rung.label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={cap}
        step={1}
        value={rung.value}
        disabled={disabled}
        aria-label={rung.label}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (Number.isNaN(raw)) return;
          rung.onChange(Math.max(min, Math.min(cap, Math.round(raw))));
        }}
        className={cn(INPUT_FRAME_CLASS, "w-16 shrink-0 px-2 text-right tabular-nums sm:w-20")}
      />
    </label>
  );
}

/**
 * Independent query caps, listed in concat order. Overlaps drop; the earlier
 * query keeps the slot. Not a nested filter — each number is its own fetch.
 */
export function QueryConcatCaps({
  rule,
  queries,
  min,
  max,
  disabled,
}: {
  rule: string;
  queries: QueryCapRung[];
  min: number;
  max: number;
  disabled: boolean;
}) {
  return (
    <div className="mt-5">
      <p className="type-label text-muted-foreground mb-1 font-semibold tracking-wide">
        Queries
      </p>
      <p className="text-muted-foreground mb-3 type-meta">{rule}</p>
      <div className="flex flex-col gap-1.5">
        {queries.map((rung) => (
          <QueryCapRow
            key={rung.key}
            rung={rung}
            min={min}
            max={max}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

export function SaveRow({
  pending,
  dirty,
  ok,
  onClick,
  loadError,
}: {
  pending: boolean;
  dirty: boolean;
  ok: boolean;
  onClick: () => void;
  /** When set, Save stays disabled — never overwrite a live singleton from a failed load (MESITA-737). */
  loadError?: string | null;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <Button pending={pending} disabled={!dirty || !!loadError} onClick={onClick}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {ok && !dirty && (
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
    </div>
  );
}
