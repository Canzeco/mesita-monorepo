"use client";

import { Search, X } from "lucide-react";

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
};

export function SearchBar({
  query,
  showClear,
  onQueryChange,
  onFocus,
  onClear,
  placeholder = "Search places…",
}: SearchBarProps) {
  return (
    <div className="border-border bg-card shadow-elev flex h-12 items-center gap-1 rounded-full border pr-1.5 pl-4 backdrop-blur-xl">
      <Search className="text-muted-foreground h-4 w-4 shrink-0" />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        aria-label={placeholder}
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
    </div>
  );
}
