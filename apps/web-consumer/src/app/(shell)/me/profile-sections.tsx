"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/shared";
import { ICON_CHIP_CLASS } from "@/components/consumer/me/settings-rows";
import { cn } from "@/lib/utils";

// ─── The destination grid (MESITA-1628) ────────────────────────────────────
//
// DiDi's "More Services" geometry, Mesita's ink. Three up since MESITA-3450:
// an icon chip over a title. Settings, the tenth cell, is one full-width row
// under the grid: the chip beside its title and summary.
//
// THE ICON LEADS, IN A CHIP (Pato, MESITA-2569: "those gray icons in the 9
// boxes have a 2010 app aesthetic"; he picked "A · Ink chip" from a board of
// four on the real grid). A 36px rounded square in the page grey, the glyph
// inside at full ink — iOS Settings / Linear calm. It replaced a 40px outline
// at 22% in the bottom-right corner, which read as a disabled placeholder.
// MESITA-2596 set the chip BESIDE the title and summary (one row) in a
// two-up grid; MESITA-3450 stacks it over the title in a three-up grid.
//
// NEUTRAL STILL (decision: Pato, MESITA-1132). Every chip is the same grey and
// every glyph the same ink: tinted per-cell chips give equal emphasis to every
// destination, so nothing leads. There is no `tint` prop, deliberately: a
// neutral cell cannot drift back one tile at a time.
//
// THREE COLUMNS (Pato, MESITA-3450: "Here in Me do 3 columns for boxes
// instead of 2"). At 375px a cell is ~109px, ~93px inside its padding: room
// for "Notifications" at text-sm bold, not for a chip beside it, and not for
// a summary line. So a grid cell is the chip over its title; the summary is
// its accessible name's second half. At 320px the longest titles truncate.
// Write the class as a whole string — Tailwind scans source TEXT, so
// `grid-cols-${cols}` never enters the build and the grid silently collapses
// to one column.
// TWO COLUMNS AGAIN, SHORTER (Pato, MESITA-3469: "return to the two columns
// instead, but make shit shorter. only icon and name, not more"): a cell is
// the chip beside its title in one row, no summary on screen; the summary
// stays the second half of its accessible name.
export function DestGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 items-stretch gap-2">{children}</div>;
}

// ONE MATERIAL (MESITA-1633). Everything below the header is a `DestTile`:
// one border, fill, shadow and radius. Two shapes (MESITA-3450): a grid
// `cell`, the chip over its title, and the Settings `row`, the chip beside
// its title and summary. The frames, the chip and the words are shared with
// the loading tile so the two are one box (MESITA-2701).
export type DestShape = "cell" | "row";

const TILE_MATERIAL =
  "border-border bg-card shadow-rest relative flex w-full overflow-hidden rounded-2xl border";
const TILE_FRAME: Record<DestShape, string> = {
  cell: cn(TILE_MATERIAL, "items-center gap-2.5 px-3 py-2.5"),
  row: cn(TILE_MATERIAL, "items-center gap-2.5 p-3"),
};

/** The 36px icon chip: the page grey, the glyph at full ink. The loading
 *  tile pulses the same box (MESITA-2701). */
const DEST_CHIP = cn(ICON_CHIP_CLASS, "bg-muted text-foreground");

/** The title over the summary, the tile's and its skeleton's: the words are
 *  fixed (hub-tiles.tsx), so the loading tile prints them too and a summary
 *  wraps where the page's does (Pato, MESITA-2701: "the placeholders must be
 *  similar to the page you are loading, like the sizes"). */
function TileText({
  shape,
  title,
  summary,
}: {
  shape: DestShape;
  title: string;
  summary: string;
}) {
  if (shape === "cell") {
    // The title alone, centred and `truncate`d: a long one ends in "…" at
    // 320px rather than pushing the grid.
    return (
      <span className="block min-w-0 flex-1 truncate text-sm font-bold tracking-tight">
        {title}
      </span>
    );
  }
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

/** One cell: a DESTINATION, always a route Link to `/me/<box>`. */
export function DestTile({
  shape,
  Icon,
  title,
  summary,
  href,
}: {
  shape: DestShape;
  Icon: LucideIcon;
  title: string;
  /** THREE WORDS OR FEWER — see the note above. */
  summary: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      // A grid cell shows its title only; its name says the summary too.
      aria-label={shape === "cell" ? `${title}, ${summary}` : undefined}
      className={cn(
        TILE_FRAME[shape],
        "hover:bg-muted/40 text-left transition active:scale-[0.98]",
      )}
    >
      {/* Decorative. The title and summary already say everything, so the
          chip is hidden rather than described. */}
      <span className={DEST_CHIP} aria-hidden data-dest-chip>
        <Icon className="h-[19px] w-[19px]" strokeWidth={2.1} />
      </span>
      <TileText shape={shape} title={title} summary={summary} />
    </Link>
  );
}

/** A tile in /me's loading.tsx (Pato, MESITA-2701: "the placeholders must
 *  be similar to the page you are loading, like the sizes"): the same frame
 *  in the same shape, the chip's box pulsing where its glyph will be, and
 *  the cell's own words, so the page lands without a jump. Not a cell: it links
 *  nowhere and leaves with the fallback. */
export function DestTileSkeleton({
  shape,
  title,
  summary,
}: {
  shape: DestShape;
  title: string;
  summary: string;
}) {
  return (
    <div aria-hidden className={TILE_FRAME[shape]}>
      <Skeleton className={DEST_CHIP} />
      <TileText shape={shape} title={title} summary={summary} />
    </div>
  );
}
