"use client";

import { type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { cx } from "./shared";
import { type OfferingRow } from "./offerings";

// One rung of the Controls ladder.
//
// THE ROW IS THE SWITCH. The old RailToggle was `h-6 w-11` — a 24px target
// against a 44px minimum — and the fix is not a bigger switch: the whole row
// becomes the `role="switch"` button, with the track as a plain <span> inside
// it. That gives a ~44px hit area, keeps exactly ONE interactive element per
// row (no nested-interactive violation), and keeps Space/Enter working for
// free. Rows that carry their own control (tiles, a pill, a channel picker)
// render static and take it through `control` instead.
//
// A row is NEVER merely disabled. Locked names its prerequisite, blocked
// quotes Stripe, soon says there is no engine — because a greyed-out switch
// with no reason is the exact defect this tab shipped with.

function PointsCell({ row, className }: { row: OfferingRow; className?: string }) {
  const label = row.points == null ? "—" : row.earned ? `+${row.points}` : "—";
  return (
    <span
      className={cx(
        "type-label shrink-0 font-semibold tabular-nums",
        row.earned ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      // The meter is the sum of these; an em dash means "cannot score", which
      // is different from "scores zero right now".
      aria-label={
        row.points == null
          ? `${row.label} does not count toward the offerings score`
          : `${row.label} scores ${row.earned ? row.points : 0}`
      }
    >
      {label}
    </span>
  );
}

function Track({ on, busy }: { on: boolean; busy: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-secondary" : "bg-muted-foreground/25",
      )}
    >
      <span
        className={cx(
          "bg-background inline-flex h-5 w-5 transform items-center justify-center rounded-full shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {busy && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
      </span>
    </span>
  );
}

/** Label + detail + the mobile points cell. Shared by every row variant so a
 *  switch row and a static row line up on the same grid. */
function Body({ row }: { row: OfferingRow }) {
  return (
    <span className="min-w-0 flex-1 text-left">
      <span className="block text-sm font-medium">{row.label}</span>
      <span className="text-muted-foreground mt-0.5 block line-clamp-2 text-xs leading-snug">
        {row.detail}
      </span>
      {/* Under `sm` the points cell moves beneath the label so the switch
          keeps its right-hand column instead of crushing the detail line. */}
      <PointsCell row={row} className="mt-1 block sm:hidden" />
    </span>
  );
}

function Reason({
  tone,
  icon,
  children,
}: {
  tone: "muted" | "warn";
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 type-label font-semibold",
        tone === "warn"
          ? "bg-amber-500/12 text-amber-800"
          : "text-muted-foreground bg-muted",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function LadderRow({
  row,
  busy = false,
  otherBusy = false,
  error = null,
  onToggle,
  control,
  children,
}: {
  row: OfferingRow;
  busy?: boolean;
  /** Another row on the card is mid-write — one rail writes at a time. */
  otherBusy?: boolean;
  /** Operator-facing failure for THIS row. Never a raw Edge Function string. */
  error?: string | null;
  /** Present ⇒ the row is a switch. Absent ⇒ static, and `control` renders. */
  onToggle?: (next: boolean) => void;
  /** A row that owns a different control: tiles, a pill, an action button. */
  control?: ReactNode;
  /** Nested config. Always MOUNTED — see shouldRenderConfig. */
  children?: ReactNode;
}) {
  const s = row.state;
  const isSwitch = (s.kind === "on" || s.kind === "off") && onToggle != null;
  const on = s.kind === "on";

  const right =
    s.kind === "locked" ? (
      <Reason tone="muted" icon={<Lock className="h-3 w-3" aria-hidden />}>
        {s.needs}
      </Reason>
    ) : s.kind === "blocked" ? (
      <Reason tone="warn">Stripe: {s.reason}</Reason>
    ) : s.kind === "soon" ? (
      <Reason tone="muted">Soon</Reason>
    ) : isSwitch ? (
      <Track on={on} busy={busy} />
    ) : (
      control
    );

  const inner = (
    <>
      <Body row={row} />
      <PointsCell row={row} className="hidden w-6 text-right sm:block" />
      {right}
    </>
  );

  return (
    <div className="border-border/60 border-t first:border-t-0">
      {isSwitch ? (
        // py-2.5 on a two-line body clears 44px comfortably. The whole row is
        // the control, so there is nothing else in here to click.
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={busy || otherBusy}
          onClick={() => onToggle?.(!on)}
          className={cx(
            "flex w-full items-center gap-3 py-2.5 text-left transition",
            busy || otherBusy
              ? "cursor-default opacity-60"
              : "cursor-pointer hover:opacity-90",
          )}
        >
          {inner}
        </button>
      ) : (
        <div
          className={cx(
            "flex items-center gap-3 py-2.5",
            (s.kind === "locked" || s.kind === "soon") && "opacity-70",
          )}
        >
          {inner}
        </div>
      )}

      {/* Always-mounted live region: one that mounts together with its message
          does not announce. Errors land beside the row that failed, never at
          the foot of the card. */}
      <div aria-live="polite">
        {error && (
          <div className="pb-2.5">
            <ErrorNote message={error} />
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

/** The indented sub-row a capability owns. Rendered by the caller through
 *  `shouldRenderConfig`, and hidden with CSS rather than unmounted — see that
 *  function for why unmounting silently eats a pending edit. */
export function NestedConfig({
  visible,
  label,
  children,
}: {
  visible: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "border-border/70 ml-1.5 border-l pb-3 pl-4",
        visible ? "" : "hidden",
      )}
      aria-hidden={!visible}
    >
      <p className="text-muted-foreground mb-1.5 type-label font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
