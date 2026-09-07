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
    <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
      {children}
    </div>
  );
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

// ALWAYS TWO COLUMNS (MESITA-1639). There was a `cols` prop and a four-up
// Activity row; four cells at 375px are 80px wide, which is why those four
// carried no summary. The row is two pairs now and the prop had no second
// call site, so it is gone rather than parked. If a four-up is ever wanted
// again, write the class as a whole string — Tailwind scans source TEXT, so
// `grid-cols-${cols}` never enters the build and the grid silently collapses
// to one column.
export function DestGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 items-stretch gap-2">{children}</div>;
}

// ONE SHAPE, REPEATED (MESITA-1633). The page used to stack four cell shapes
// and three fills — passport tiles, a white pair, a muted count band, then
// this grid — and two of them were 2-up white cards that looked identical
// while belonging to different groups. The band is gone and everything below
// the passport is a `DestTile` now. `StatBand`/`StatTile` went with it; a
// count is a SUMMARY LINE on the cell, not a separate material.

/** One grid cell. A DESTINATION — it has no count; things with counts are
 *  `StatTile`s in the muted band above. */
export function DestTile({
  Icon,
  title,
  summary,
  onClick,
  disabled,
  soon = false,
  full = false,
}: {
  Icon: LucideIcon;
  title: string;
  /** THREE WORDS OR FEWER — see the note above. */
  summary: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Parked: visible, inert, honest. Same contract the band used to carry. */
  soon?: boolean;
  /** Spans both columns — for a cell with no partner, so the last row is a
   *  deliberate full-width block rather than a half-empty one. */
  full?: boolean;
}) {
  const inert = disabled || soon;
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={inert}
      aria-disabled={inert}
      title={soon ? "Coming soon" : undefined}
      className={cn(
        "border-border bg-card shadow-rest relative flex min-h-[92px] w-full flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition",
        full && "col-span-2",
        inert ? "opacity-60" : "hover:bg-muted/40 active:scale-[0.98]",
      )}
    >
      <span className="min-w-0">
        {/* The gutter is reserved on the SUMMARY only. The corner glyph is
            `bottom-2 h-10`, so in a 92px cell it occupies y 44-84 while the
            title sits at y 14-34 — they never touch, and a gutter on the
            title was 36px of width spent on nothing. Measured: at 320px it
            clipped "Notifications" (83.7px into 74px) and "Reservations"
            (85.7px); without it both fit with 24px to spare. The title is
            `truncate`, so it can never wrap down into the glyph. */}
        <span className="block truncate text-sm font-bold tracking-tight">
          {title}
        </span>
        {soon ? (
          <span className="border-border text-muted-foreground type-meta mt-1 inline-block rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase">
            Soon
          </span>
        ) : (
          <span className="text-muted-foreground mt-0.5 block pr-9 text-xs leading-snug">
            {summary}
          </span>
        )}
      </span>
      {/* Decorative. The title and summary already say everything, so
          this is hidden rather than described. */}
      <Icon
        className="text-foreground pointer-events-none absolute right-2.5 bottom-2 h-10 w-10 opacity-[0.22]"
        aria-hidden
      />
    </button>
  );
}
