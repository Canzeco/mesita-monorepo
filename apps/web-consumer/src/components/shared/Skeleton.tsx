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


// A standard row placeholder (avatar + two lines) matching activity /
// notification / reservation list rows.
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center gap-3 p-3", className)}>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
