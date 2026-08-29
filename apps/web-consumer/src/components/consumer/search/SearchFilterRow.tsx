"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

// The ONLY map-chrome control besides the query pill. Status and
// Category live in the Filters sheet — never as chips on the canvas.

export function SearchFilterRow({
  active,
  onOpenFilters,
}: {
  active: boolean;
  onOpenFilters: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenFilters}
      aria-label={active ? "Filters (active)" : "Filters"}
      aria-haspopup="dialog"
      aria-pressed={active}
      className={cn(
        "relative flex h-12 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-semibold whitespace-nowrap backdrop-blur transition active:scale-[0.97]",
        "bg-card/95 text-foreground/80 shadow-rest",
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
      Filters
      {active && (
        <span
          aria-hidden
          className="bg-destructive border-card absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
        />
      )}
    </button>
  );
}
