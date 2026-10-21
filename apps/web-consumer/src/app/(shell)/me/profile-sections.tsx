"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

// ─── The destination grid (MESITA-1628) ────────────────────────────────────
//
// DiDi's "More Services" geometry, Mesita's ink. Two up: an icon chip, a
// title, and a subtitle of two or three words.
//
// THE ICON LEADS, IN A CHIP (Pato, MESITA-2569: "those gray icons in the 9
// boxes have a 2010 app aesthetic"; he picked "A · Ink chip" from a board of
// four on the real grid). A 36px rounded square in the page grey, the glyph
// inside at full ink — iOS Settings / Linear calm. It replaced a 40px outline
// at 22% in the bottom-right corner, which read as a disabled placeholder.
//
// NEUTRAL STILL (decision: Pato, MESITA-1132). Every chip is the same grey and
// every glyph the same ink: tinted per-cell chips give equal emphasis to every
// destination, so nothing leads. There is no `tint` prop, deliberately: a
// neutral cell cannot drift back one tile at a time.
//
// COPY IS THE LAYOUT CONSTRAINT, NOT THE CSS. DiDi's subtitles are two or
// three words ("See More", "Fast and safe", "Up to 6%") and that is why its
// grid never goes ragged. At 375px a cell is ~167px; at 320px it is ~140px.
// The summary has the cell's full width now (the corner glyph and its gutter
// are gone) and wraps rather than truncates. Keep every `summary` to three
// words or fewer and the question never comes up. The grid stretches each
// row to its taller cell.

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
      className="border-border bg-card shadow-rest hover:bg-muted/40 relative flex w-full flex-col overflow-hidden rounded-2xl border p-3.5 text-left transition active:scale-[0.98]"
    >
      {/* Decorative. The title and summary already say everything, so the
          chip is hidden rather than described. */}
      <span
        className="bg-muted text-foreground mb-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
        aria-hidden
        data-dest-chip
      >
        <Icon className="h-[19px] w-[19px]" strokeWidth={2.1} />
      </span>
      {/* The title is `truncate`, so a long one never pushes the row. */}
      <span className="block truncate text-sm font-bold tracking-tight">
        {title}
      </span>
      <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
        {summary}
      </span>
    </Link>
  );
}
