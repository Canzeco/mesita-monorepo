"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

// ─── The destination grid (MESITA-1628) ────────────────────────────────────
//
// DiDi's "More Services" geometry, Mesita's ink. Two up, a title, a subtitle
// of two or three words, and a line glyph in the bottom-right corner.
//
// NEUTRAL, AND THAT IS THE WHOLE POINT OF THE PORT (decision: Pato,
// MESITA-1132). What makes the DiDi screen feel good is eleven colourful
// illustrations, and this page refuses exactly that: tinted per-cell chips
// give equal emphasis to every destination, so nothing leads. The shape
// transfers and the colour does not — the glyph is `text-foreground` at 22%,
// loud enough to read as intentional, quiet enough to leave the header
// leading. There is no `tint` prop, deliberately: a neutral cell cannot drift
// back one tile at a time.
//
// COPY IS THE LAYOUT CONSTRAINT, NOT THE CSS. DiDi's subtitles are two or
// three words ("See More", "Fast and safe", "Up to 6%") and that is why its
// grid never goes ragged. At 375px a cell is ~167px and the glyph gutter takes
// 38px; at 320px the whole cell is ~140px. The first build reserved that
// gutter and truncated, which clipped five of eight subtitles into ellipses —
// worse than wrapping. Keep every `summary` to three words or fewer and the
// question never comes up. `min-h` holds the rows even when one title wraps.

// ALWAYS TWO COLUMNS (MESITA-1639). Four cells at 375px are 80px wide, too
// narrow for a summary line. If a four-up is ever wanted, write the class as a
// whole string — Tailwind scans source TEXT, so `grid-cols-${cols}` never
// enters the build and the grid silently collapses to one column.
export function DestGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 items-stretch gap-2">{children}</div>;
}

// ONE SHAPE, REPEATED (MESITA-1633). Everything below the header is a
// `DestTile`: one cell shape, one fill. A count is a SUMMARY LINE on the cell,
// not a separate material.

/** One grid cell: a DESTINATION, always a route Link to `/me/<box>`. */
export function DestTile({
  Icon,
  title,
  summary,
  href,
}: {
  Icon: LucideIcon;
  title: string;
  /** THREE WORDS OR FEWER — see the note above. */
  summary: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-card shadow-rest hover:bg-muted/40 relative flex min-h-[92px] w-full flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition active:scale-[0.98]"
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
        <span className="text-muted-foreground mt-0.5 block pr-9 text-xs leading-snug">
          {summary}
        </span>
      </span>
      {/* Decorative. The title and summary already say everything, so
          this is hidden rather than described. */}
      <Icon
        className="text-foreground pointer-events-none absolute right-2.5 bottom-2 h-10 w-10 opacity-[0.22]"
        aria-hidden
      />
    </Link>
  );
}
