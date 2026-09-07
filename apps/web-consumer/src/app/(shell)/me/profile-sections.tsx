"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Modular boxes ─────────────────────────────────────────────────────────

// COLOUR LIVES ON THE PASSPORT, NOWHERE ELSE ON THIS PAGE (decision: Pato,
// MESITA-1132). Every box used to carry its own tinted icon chip — pink
// Instagram, amber Class, blue Plan, violet AI, sky Profile — on the theory
// that colour made the surface read premium. Seven accents in a vertical stack
// did the opposite: they gave equal emphasis to seven things, so nothing led,
// and they competed with the one place colour carries meaning. The passport
// says the class in a metal; the list underneath is a list.
//
// There is no `tint` prop any more, deliberately. A neutral chip cannot drift
// back one box at a time.

function BoxShell({
  icon,
  title,
  summary,
  trailing,
  onClick,
  disabled,
  soon = false,
  bare = false,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  trailing?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  soon?: boolean;
  /** Renders without its own border/rounding/background — for a row that
   *  sits inside a `BoxGroup`, which supplies all three on the wrapper
   *  instead (MESITA-1609). */
  bare?: boolean;
}) {
  // Parked (soon) rows are BLOCKED, not removed: kept visible so the surface
  // reads as intentional, but non-interactive with a Soon pill. Un-park =
  // drop `soon` and the row is live again.
  const inert = disabled || soon;
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={inert}
      aria-disabled={inert}
      title={soon ? "Coming soon" : undefined}
      className={cn(
        "flex w-full items-center gap-3.5 p-4 text-left transition active:scale-[0.99]",
        bare ? "bg-transparent" : "border-border bg-card rounded-2xl border",
        inert ? "opacity-60" : "hover:bg-muted/50",
      )}
    >
      <span className="bg-muted text-foreground/70 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight">{title}</span>
          {soon && (
            <span className="border-border text-muted-foreground type-meta rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase">
              Soon
            </span>
          )}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          {summary}
        </span>
      </span>
      {trailing}
      {!soon && (
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

export function BoxRow({
  Icon,
  title,
  summary,
  onClick,
  disabled,
  soon,
  bare,
}: {
  Icon: LucideIcon;
  title: string;
  summary: string;
  onClick: () => void;
  disabled?: boolean;
  soon?: boolean;
  bare?: boolean;
}) {
  return (
    <BoxShell
      icon={<Icon className="h-[22px] w-[22px]" />}
      title={title}
      summary={summary}
      onClick={onClick}
      disabled={disabled}
      soon={soon}
      bare={bare}
    />
  );
}

// Groups sibling BoxRows (`bare`) under ONE border/rounding/background, with
// a hairline divider between — MESITA-1609's Alerts/Visits/Reservations
// cluster, which reads as the one container they were yesterday (Activity)
// rather than three unrelated rows. A flat, evenly-gapped list of ordinary
// BoxRows does NOT read as related — verified against a wireframe during
// design review — so the grouping needs this explicit wrapper, not just
// adjacency in the JSX.
export function BoxGroup({ children }: { children: ReactNode }) {
  return (
    <div className="border-border bg-card divide-border overflow-hidden rounded-2xl border divide-y">
      {children}
    </div>
  );
}

// ─── The status band (MESITA-1622) ─────────────────────────────────────────
//
// THE PAGE TEACHES ITS OWN RULE, AND THIS IS HALF OF IT. The band holds things
// that carry a COUNT; the BoxRow list below holds DESTINATIONS. Nothing labels
// that split — it is legible because the two zones are different MATERIAL: the
// band is a `bg-muted` fill with no border, the list is a white card. Wallet
// and Plan were drawn as tiles in the first sketch and moved to the list for
// exactly this reason: they have no number, so as tiles they made the rule
// unlearnable.
//
// MATERIAL, NOT MORE CHROME. The band's first build gave every tile the list's
// own `bg-card` + border treatment, which made the whole screen one
// undifferentiated mosaic of cards — a stack of cards standing in for a
// layout. Two materials, two meanings, no extra ink.
//
// THE COUNT DOES NOT SHOUT. It sits at `text-lg` under a bold label, not above
// it in a display numeral. At 26px the visit count outweighed the guest's own
// name and their class on their own identity screen — and with the catalog
// empty, the number it was shouting was zero.

/** One band cell. Parked cells use the same `soon` contract as `BoxShell`. */
export function StatTile({
  Icon,
  label,
  count,
  loading = false,
  soon = false,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  /** `null` and `0` both read as the empty state — see the note below. */
  count?: number | null;
  loading?: boolean;
  /** Parked: visible, inert, honest. Un-park = drop the flag. */
  soon?: boolean;
  onClick?: () => void;
}) {
  // ZERO AND UNKNOWN READ THE SAME, ON PURPOSE. A metrics read that failed and
  // an account with no visits are both "nothing to show yet", and the honest
  // copy for both is the same words. Printing a hard `0` for a failed read
  // would state a fact we do not have.
  const empty = count == null || count === 0;
  const value = loading ? "…" : empty ? "None yet" : String(count);
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      aria-disabled={soon}
      title={soon ? "Coming soon" : undefined}
      // Value THEN label: a screen reader announcing "Visits" alone tells the
      // guest nothing they could not see from the label.
      aria-label={soon ? `${label}: coming soon` : `${label}: ${value}`}
      className={cn(
        "bg-muted flex min-h-[84px] w-full flex-col items-start justify-between rounded-2xl p-3 text-left transition",
        soon ? "opacity-55" : "hover:bg-muted/70 active:scale-[0.98]",
      )}
    >
      <Icon className="text-foreground/55 h-[18px] w-[18px] shrink-0" />
      <span className="w-full min-w-0">
        {soon ? (
          <span className="border-border text-muted-foreground type-meta inline-block rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase">
            Soon
          </span>
        ) : (
          <span
            className={cn(
              "block truncate",
              empty || loading
                ? "text-muted-foreground text-sm font-semibold"
                : "font-display text-lg leading-none font-semibold tracking-tight",
            )}
          >
            {value}
          </span>
        )}
        {/* `truncate` and not a wrap: at 320px the cell is 80px wide and
            "Bookings" needs ~62px, so it clears with a glyph to spare. A wrap
            here would make one cell taller than its siblings. */}
        <span className="mt-[3px] block truncate text-xs font-bold tracking-tight">
          {label}
        </span>
      </span>
    </button>
  );
}

/** Three cells, equal width, equal height. */
export function StatBand({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 items-stretch gap-2">{children}</div>;
}

// ─── The destination grid (MESITA-1628) ────────────────────────────────────
//
// DiDi's "More Services" geometry, Mesita's ink. Two up, a title, a subtitle
// of two or three words, and a line glyph in the bottom-right corner.
//
// NEUTRAL, AND THAT IS THE WHOLE POINT OF THE PORT. What makes the DiDi screen
// feel good is eleven colourful illustrations, and this page deleted exactly
// that (MESITA-1132, see the note at the top of this file): tinted per-box
// chips gave equal emphasis to seven things, so nothing led, and they competed
// with the passport. DiDi can spend that colour budget because its identity is
// one grey header line. Mesita's identity is a metal-banded card whose entire
// job is that colour means class, sitting directly above this grid. So the
// shape transfers and the colour does not — the glyph is `text-foreground` at
// 22%, loud enough to read as intentional, quiet enough to leave the band
// leading. Do not tint these one cell at a time; that is how the chips came
// back last time.
//
// COPY IS THE LAYOUT CONSTRAINT, NOT THE CSS. DiDi's subtitles are two or
// three words ("See More", "Fast and safe", "Up to 6%") and that is why its
// grid never goes ragged. At 375px a cell is ~167px and the glyph gutter takes
// 38px; at 320px the whole cell is ~140px. The first build reserved that
// gutter and truncated, which clipped five of eight subtitles into ellipses —
// worse than wrapping. Keep every `summary` to three words or fewer and the
// question never comes up. `min-h` holds the rows even when one title wraps.

export function DestGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 items-stretch gap-2">{children}</div>;
}

/** One grid cell. A DESTINATION — it has no count; things with counts are
 *  `StatTile`s in the muted band above. */
export function DestTile({
  Icon,
  title,
  summary,
  onClick,
  disabled,
}: {
  Icon: LucideIcon;
  title: string;
  /** THREE WORDS OR FEWER — see the note above. */
  summary: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        "border-border bg-card shadow-rest relative flex min-h-[92px] w-full flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition",
        disabled ? "opacity-60" : "hover:bg-muted/40 active:scale-[0.98]",
      )}
    >
      <span className="min-w-0">
        {/* The gutter is reserved on the TEXT, not by shrinking the cell, so
            the glyph can sit in the corner without ever overlapping a word. */}
        <span className="block truncate pr-9 text-sm font-bold tracking-tight">
          {title}
        </span>
        <span className="text-muted-foreground mt-0.5 block pr-9 text-xs leading-snug">
          {summary}
        </span>
      </span>
      {/* Decorative. The title and summary already say everything, so this is
          hidden rather than described. */}
      <Icon
        className="text-foreground pointer-events-none absolute right-2.5 bottom-2 h-10 w-10 opacity-[0.22]"
        aria-hidden
      />
    </button>
  );
}
