"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

// The map's one chrome control. It CARRIES ITS LABEL NOW (Pato, 2026-09-01:
// "filters button must be more visible"), reversing the icon-only rule this
// file used to state.
//
// Why it lost: a 48px translucent white disc floating on a Google basemap is
// camouflage. The map is already mostly white and pale grey, `bg-card/95` is
// nearly the same value, and the only thing separating them was a soft shadow.
// The count badge was doing all the work, and it only appears once a filter is
// already applied — so the affordance was least visible exactly when a guest
// had not found it yet.
//
// Solid surface, a border, the word, and a real shadow. Applied state goes
// primary-filled so "I have filters on" reads at a glance instead of through a
// 16px badge.
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
      aria-label={applied ? `Filters, ${count} applied` : "Filter places"}
      aria-haspopup="dialog"
      aria-pressed={applied}
      className={cn(
        "shadow-elev type-body relative flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 font-semibold transition active:scale-[0.97]",
        applied
          ? "border-primary bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card text-foreground",
      )}
    >
      <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      Filters
      {applied && (
        <span className="bg-primary-foreground/25 type-meta ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 leading-none font-bold">
          {count}
        </span>
      )}
    </button>
  );
}
