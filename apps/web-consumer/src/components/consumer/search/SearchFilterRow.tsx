"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

// Icon-only map-chrome control. Status and Super Category live in the
// sheet — never as chips, never as a "Filters" label on the canvas. A
// red count is the only on-canvas signal that anything is applied.

export function SearchFilterRow({
  count,
  onOpenFilters,
}: {
  count: number;
  onOpenFilters: () => void;
}) {
  const applied = count > 0;
  return (
    <button
      type="button"
      onClick={onOpenFilters}
      aria-label={applied ? `${count} applied` : "Filter places"}
      aria-haspopup="dialog"
      aria-pressed={applied}
      className={cn(
        "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full backdrop-blur transition active:scale-[0.97]",
        "bg-card/95 text-foreground/80 shadow-rest",
      )}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      {applied && (
        <span className="bg-destructive text-destructive-foreground type-meta absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 leading-none font-bold">
          {count}
        </span>
      )}
    </button>
  );
}
