// A SETTING AND ITS VALUE, one per line, hairline-divided inside one card —
// the shape Account and the Setup index both use (MESITA-1840, 2002). It
// lived inside `OrdersView` until MESITA-2017 gave five more Setup halves
// the same rows; a row that is drawn on six screens is a primitive.
//
// Not `FactRow`: that lays facts out in a wrapping row, which is right for
// four read-only numbers on a wide card and wrong for a list somebody scans
// down looking for the one they came to change.
//
// ── `control` IS A TYPED UNION (MESITA-2034, Eng Review Code Quality 2) ────
//
// Five kinds, and a row carries exactly one — §3 of the Setup standard says
// "never two controls" and this makes that a compile error instead of a
// convention eleven view-authors have to remember. Badge-alone (a state fact
// with no verb — Reputation's "Mesita" row, every Partner checklist row) is
// `{ kind: "value" }` wearing a `<Badge>` as its node, not a sixth kind.
//
// `value` STAYS, UNCHANGED, AS A LEGACY PROP (Eng Review Round 2, a confirmed
// live break). `Rule` is shared between Setup halves (converting to `control`
// in this PR) and Activity halves (out of scope, D14) — `LineView.tsx` calls
// `<Rule value={...} />` inside `<Half label="Activity">` today. Dropping
// `value` would break that caller silently the moment this file changed.
// Every NEW call site in this PR uses `control`; `value` is the bridge that
// keeps the Activity halves this PR promises not to touch actually untouched.
// The Activity follow-up issue collapses `Rule` onto `control` alone once
// those callers migrate — the same shape `Section` uses elsewhere (D14).
import { cn } from "@/lib/utils";
import { SELECT_CLASS } from "@/lib/ui-classes";

export const RULES_CARD =
  "border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border";

export type RuleControl =
  | { kind: "switch"; on: boolean; onChange: (v: boolean) => void; label: string }
  | {
      kind: "select";
      value: string;
      onChange: (v: string) => void;
      options: { value: string; label: string }[];
      "aria-label"?: string;
    }
  | { kind: "value"; text: React.ReactNode }
  | {
      kind: "button";
      label: string;
      onClick: () => void;
      emphasis?: "ghost" | "primary";
      disabled?: boolean;
    }
  | {
      kind: "input";
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
      inputMode?: "text" | "numeric";
      "aria-label"?: string;
    };

import { GHOST_PILL_BUTTON_CLASS, INPUT_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { Switch } from "@/components/shared/Switch";

function RuleControlView({
  control,
  labelId,
  disabled,
}: {
  control: RuleControl;
  labelId: string;
  /** The row's own `disabled` (§3: greyed, never hidden). Every interactive
   *  control honours it directly — dimming the row while leaving its switch
   *  or select clickable would let an operator change a setting the row
   *  claims is inert. */
  disabled: boolean;
}) {
  switch (control.kind) {
    case "switch":
      return (
        <Switch
          on={control.on}
          onChange={control.onChange}
          label={control.label}
          disabled={disabled}
        />
      );
    case "select":
      return (
        <select
          aria-labelledby={labelId}
          aria-label={control["aria-label"]}
          value={control.value}
          onChange={(e) => control.onChange(e.target.value)}
          disabled={disabled}
          className={SELECT_CLASS}
        >
          {control.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "value":
      return <>{control.text}</>;
    case "button":
      return (
        <button
          type="button"
          onClick={control.onClick}
          disabled={control.disabled || disabled}
          className={
            control.emphasis === "primary" ? PILL_BUTTON_CLASS : GHOST_PILL_BUTTON_CLASS
          }
        >
          {control.label}
        </button>
      );
      case "input":
      return (
        <input
          aria-labelledby={labelId}
          aria-label={control["aria-label"]}
          value={control.value}
          onChange={(e) => control.onChange(e.target.value)}
          placeholder={control.placeholder}
          inputMode={control.inputMode}
          disabled={disabled}
          className={cn(
            INPUT_CLASS,
            "h-8 w-full",
            control.inputMode === "numeric" ? "sm:w-44" : "sm:w-56",
          )}
        />
      );
  }
}

export function Rule({
  id,
  label,
  control,
  value,
  badge,
  note,
  disabled = false,
}: {
  /** Stable id for the label; when omitted one is derived from `label`, but an
   *  explicit id is safer when two rows in the same card share a label text. */
  id?: string;
  label: string;
  /** The typed control (§3). Every Setup-half call site in this PR uses this. */
  control?: RuleControl;
  /** Legacy prop, kept for Activity-half callers this PR does not touch
   *  (LineView.tsx and any other `<Half label="Activity">` caller). New
   *  Setup-half rows use `control`, never this. */
  value?: React.ReactNode;
  /** Precedes the control: a state fact with a verb beside it
   *  (`[Connected] [Reconnect]`). Never a second control. */
  badge?: React.ReactNode;
  note?: React.ReactNode;
  /** Greyed, never hidden: a row that vanishes teaches an operator the
   *  setting does not exist. */
  disabled?: boolean;
}) {
  const labelId = id ?? `rule-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  // ONLY `input` (and, from T8, `textarea`/`phone`) drops to its own line
  // below `sm` — §3: "Switch, Select, Badge or Button stays trailing". Wrap
  // is scoped to the input case alone; every other control keeps the row
  // non-wrapping so it always reads as one line, cramped or not.
  const stacksBelowSm = control?.kind === "input";
  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-x-4 gap-y-2 px-4 py-2.5",
        stacksBelowSm && "flex-wrap sm:flex-nowrap",
        disabled && "opacity-60",
      )}
    >
      <div
        className={cn(
          "min-w-0 flex-1",
          stacksBelowSm && "basis-full sm:basis-auto",
        )}
      >
        <p id={labelId} className="text-[13px] font-medium">
          {label}
        </p>
        {note && (
          <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
            {note}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 text-[13px] font-semibold tabular-nums",
          stacksBelowSm && "w-full sm:w-auto",
        )}
      >
        {badge}
        {control ? (
          <RuleControlView control={control} labelId={labelId} disabled={disabled} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}
