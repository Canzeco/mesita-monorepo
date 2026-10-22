import { cn } from "@/lib/utils";

// Skeleton primitives for loading states that know their layout.
// Prefer these over a centered spinner whenever the destination's shape is
// known (lists, cards, detail pages): the page appears to "arrive" instead
// of blinking through a blank spinner frame.

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("bg-muted animate-pulse rounded-lg", className)}
    />
  );
}

/** One line of text that has not arrived, exactly as tall as the real line
 *  (Pato, MESITA-2701: "the placeholders must be similar to the page you are
 *  loading, like the sizes"). `className` takes the REAL line's type classes
 *  (`text-sm`, `type-label`, `text-lg leading-tight`, its margin): one
 *  non-breaking space gives the box the real line-height, so no px is
 *  guessed, and the bar fills its middle three fifths. `bar` sets the bar's
 *  width. */
export function SkeletonLine({
  className,
  bar,
}: {
  className?: string;
  bar?: string;
}) {
  return (
    // Spans throughout, so a line is phrasing content and may sit in a <p>.
    <span aria-hidden className={cn("relative block", className)}>
      &nbsp;
      <span
        className={cn(
          "bg-muted absolute inset-y-1/5 left-0 w-1/2 animate-pulse rounded-lg",
          bar,
        )}
      />
    </span>
  );
}

// A list row placeholder mirroring NotificationRow (notification-row.tsx),
// its one caller's row (MESITA-2701; a 40px avatar disc before): p-3, the
// 64px rounded-xl photo, then the place name (14px snug), the outcome (12px,
// 2px under it) and the date (13px body, 4px under that).
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex gap-3 p-3", className)}>
      <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <SkeletonLine className="text-sm leading-snug" bar="w-2/5" />
        <SkeletonLine className="mt-0.5 text-xs" bar="w-3/5" />
        <SkeletonLine className="type-body mt-1" bar="w-1/3" />
      </div>
    </div>
  );
}
