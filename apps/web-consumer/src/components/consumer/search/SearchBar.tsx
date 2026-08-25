"use client";

import type { RefObject } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared by Search (discovery) and Visit (the wallet's place list, MESITA-1071).
// The filter affordance is OPTIONAL because only discovery has filters to open —
// the wallet would render a tune icon wired to nothing, and a control that does
// nothing is worse than no control. Omit `onOpenFilters` and the divider and
// button drop out with it.
type SearchBarProps = {
  query: string;
  showClear: boolean;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  /** Defaults to the discovery wording; the wallet asks a narrower question. */
  placeholder?: string;
  onFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Opens the shared discovery Filters sheet. Omit on Visit. */
  onOpenFilters?: () => void;
  /** Any deviation from filter defaults — drives the trigger dot. */
  filtersActive?: boolean;
};

export function SearchBar({
  query,
  showClear,
  onQueryChange,
  onFocus,
  onClear,
  placeholder = "Search places…",
  inputRef,
  onOpenFilters,
  filtersActive = false,
}: SearchBarProps) {
  return (
    <div className="border-border bg-card/95 shadow-elev flex h-12 shrink-0 items-center rounded-full border pl-4 backdrop-blur-xl">
      <Search className="text-muted-foreground h-4 w-4 shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {onOpenFilters && (
        <>
          <span className="bg-border h-5 w-px shrink-0" aria-hidden />
          <button
            type="button"
            onClick={onOpenFilters}
            aria-label={filtersActive ? "Filters (active)" : "Filters"}
            aria-haspopup="dialog"
            title={filtersActive ? "Filters (active)" : "Filters"}
            className={cn(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition",
              filtersActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filtersActive && (
              <span
                aria-hidden
                className="bg-primary border-card absolute top-1.5 right-1.5 h-2 w-2 rounded-full border"
              />
            )}
          </button>
        </>
      )}
    </div>
  );
}
