"use client";

import { SlidersHorizontal, X } from "lucide-react";

// Shared "filters are coming soon" panel. Both filter surfaces (Home Swipe
// FilterSheet + Search FiltersSheet) are parked behind this while we finish
// the real filtering backend: the trigger still opens the sheet, but instead
// of chips it shows this single coming-soon state. Un-park = restore each
// sheet's real body and drop this. Rendered INSIDE a LocalSheet by each caller.
export function FiltersComingSoon({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div className="flex items-center gap-2">
            <p className="font-display text-base leading-tight font-semibold">
              Filters
            </p>
            <span className="border-border text-muted-foreground rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase">
              Soon
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-8 w-8 items-center justify-center rounded-full transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
          <SlidersHorizontal className="h-6 w-6" />
        </span>
        <p className="mt-4 text-base font-semibold">Filters are coming soon</p>
        <p className="text-muted-foreground mt-1.5 max-w-[280px] text-sm leading-relaxed">
          We&apos;re polishing how you narrow places down. For now, browse the
          full list — smart filters land shortly.
        </p>
      </div>
    </div>
  );
}
