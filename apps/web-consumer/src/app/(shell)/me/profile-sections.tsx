"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/shared";
import { ICON_CHIP_CLASS } from "@/components/consumer/me/settings-rows";
import { cn } from "@/lib/utils";

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
// Since MESITA-2596 the chip sits BESIDE the title and summary (one row),
// which made every tile shorter; the grid is still two columns.
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

// ONE ROW, NOT A STACK (Pato, MESITA-2596: "make these settings boxes a bit
// shorter, currently too tall. still keep two columns"): the chip sits
// beside the title and summary, so a tile is ~64px, not ~100. The frame, the
// chip and the words are shared with the loading tile so the two are one box
// (MESITA-2701).
const TILE_FRAME =
  "border-border bg-card shadow-rest relative flex w-full items-center gap-2.5 overflow-hidden rounded-2xl border p-3";

/** The 36px icon chip: the page grey, the glyph at full ink. The loading
 *  tile pulses the same box (MESITA-2701). */
const DEST_CHIP = cn(ICON_CHIP_CLASS, "bg-muted text-foreground");

/** The title over the summary, the tile's and its skeleton's: the words are
 *  fixed (hub-tiles.tsx), so the loading tile prints them too and a summary
 *  wraps where the page's does (Pato, MESITA-2701: "the placeholders must be
 *  similar to the page you are loading, like the sizes"). */
function TileText({ title, summary }: { title: string; summary: string }) {
  return (
    <span className="min-w-0 flex-1">
      {/* The title is `truncate`, so a long one never pushes the row. */}
      <span className="block truncate text-sm font-bold tracking-tight">
        {title}
      </span>
      <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
        {summary}
      </span>
    </span>
  );
}

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
      className={cn(
        TILE_FRAME,
        "hover:bg-muted/40 text-left transition active:scale-[0.98]",
      )}
    >
      {/* Decorative. The title and summary already say everything, so the
          chip is hidden rather than described. */}
      <span className={DEST_CHIP} aria-hidden data-dest-chip>
        <Icon className="h-[19px] w-[19px]" strokeWidth={2.1} />
      </span>
      <TileText title={title} summary={summary} />
    </Link>
  );
}

/** A tile in /me's loading.tsx (Pato, MESITA-2701: "the placeholders must
 *  be similar to the page you are loading, like the sizes"): the same frame,
 *  the chip's box pulsing where its glyph will be, and the cell's own title
 *  and summary, so a summary that wraps to two lines on a phone is two lines
 *  here too (a one-line bar drew the grid short). Not a cell: it links
 *  nowhere and leaves with the fallback. */
export function DestTileSkeleton({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <div aria-hidden className={TILE_FRAME}>
      <Skeleton className={DEST_CHIP} />
      <TileText title={title} summary={summary} />
    </div>
  );
}
