"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";

type SearchBarProps = {
  query: string;
  showClear: boolean;
  filtersActive: boolean;
  onQueryChange: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onOpenFilters: () => void;
};

export function SearchBar({
  query,
  showClear,
  filtersActive,
  onQueryChange,
  onFocus,
  onClear,
  onOpenFilters,
}: SearchBarProps) {
  return (
    <div className="border-border bg-card shadow-elev flex h-12 items-center gap-1 rounded-full border pr-1.5 pl-4 backdrop-blur-xl">
      <Search className="text-muted-foreground h-4 w-4 shrink-0" />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        placeholder="Search places…"
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground shrink-0 transition"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {/* Filter now lives inside the bar (reference layout): a hairline
          divider then the tune icon, replacing the standalone chip below. */}
      <span className="bg-border h-6 w-px shrink-0" aria-hidden="true" />
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label={filtersActive ? "Filters (active)" : "Filters"}
        title={filtersActive ? "Filters (active)" : "Filters"}
        className="text-foreground hover:text-primary relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {/* Red "filters set" dot (MESITA-633) — any deviation from the
            sheet's defaults lights it. Replaced the old activeChips
            count badge (dead since the chips were parked). */}
        {filtersActive && (
          <span
            className="ring-card absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
