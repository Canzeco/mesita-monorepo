"use client";

import {
  CalendarCheck,
  Heart,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SwipeActionRowProps = {
  filtersActive: boolean;
  saved: boolean;
  onOpenFilters: () => void;
  onSkip: () => void;
  onOpenInfo: () => void;
  onSave: () => void;
};

export function SwipeActionRow({
  filtersActive,
  saved,
  onOpenFilters,
  onSkip,
  onOpenInfo,
  onSave,
}: SwipeActionRowProps) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label={filtersActive ? "Filters (active)" : "Filters"}
        title={filtersActive ? "Filters (active)" : "Filters"}
        className="border-border bg-card text-foreground/70 hover:bg-muted flex h-12 flex-1 items-center justify-center rounded-lg border transition active:scale-[0.97]"
      >
        <span className="relative">
          <SlidersHorizontal className="h-5 w-5" />
          {/* Red "filters set" dot (MESITA-633) — any deviation from
              the sheet's defaults lights it. */}
          {filtersActive && (
            <span
              className="ring-card absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2"
              aria-hidden="true"
            />
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onSkip}
        aria-label="Skip"
        title="Skip"
        className="border-border bg-card text-foreground/70 hover:bg-muted flex h-12 flex-1 items-center justify-center rounded-lg border transition active:scale-[0.97]"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onOpenInfo}
        aria-label="About this place"
        title="About this place"
        className="border-border bg-card text-foreground/70 hover:bg-muted flex h-12 flex-1 items-center justify-center rounded-lg border transition active:scale-[0.97]"
      >
        <Store className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onSave}
        aria-label={saved ? "Saved" : "Save"}
        title={saved ? "Saved" : "Save"}
        className={cn(
          "flex h-12 flex-1 items-center justify-center rounded-lg border transition active:scale-[0.97]",
          saved
            ? "border-red-500/50 bg-red-500/12 text-red-600 hover:bg-red-500/18"
            : "border-border bg-card text-secondary hover:bg-muted",
        )}
      >
        <Heart className={cn("h-5 w-5", saved && "fill-current")} />
      </button>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label="Reserve (coming soon)"
        title="Reserve (coming soon)"
        className="border-border bg-muted/40 text-muted-foreground/70 flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-lg border"
      >
        <CalendarCheck className="h-5 w-5" />
      </button>
    </div>
  );
}
