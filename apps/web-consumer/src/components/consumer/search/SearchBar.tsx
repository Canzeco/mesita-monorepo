"use client";

import type { RefObject } from "react";
import { Compass, Search, X } from "lucide-react";
import { countryBarChip } from "@/lib/search-scope";
import { cn } from "@/lib/utils";

// Shared by Search and Visit (the wallet's place list, MESITA-1071).
// Query field only. Search's Status + Super Category live in the
// Filters sheet, opened by SearchFilterRow beside the bar. Visit omits
// that.
// `onOpenScope` stays as an optional far-right control for hosts that
// still want country + location on the pill.
type SearchBarProps = {
  query: string;
  showClear: boolean;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  /** Defaults to the discovery wording; the wallet asks a narrower question. */
  placeholder?: string;
  onFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Opens the two-knob scope sheet (country + location). Omit on Visit. */
  onOpenScope?: () => void;
  /** ISO country shown on the chip; null renders the Any globe. */
  countryCode?: string | null;
  /** Location is live or connected — the compass fills primary. */
  locationSet?: boolean;
};

export function SearchBar({
  query,
  showClear,
  onQueryChange,
  onFocus,
  onClear,
  placeholder = "Search places…",
  inputRef,
  onOpenScope,
  countryCode = null,
  locationSet = false,
}: SearchBarProps) {
  const scopeLabel = [
    countryCode ?? "any country",
    locationSet ? "location set" : "location not set",
  ].join(", ");

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
      {onOpenScope && (
        <>
          <span className="bg-border h-5 w-px shrink-0" aria-hidden />
          <button
            type="button"
            onClick={onOpenScope}
            aria-label={scopeLabel}
            aria-haspopup="dialog"
            title={scopeLabel}
            className="text-foreground hover:bg-muted/60 mr-1 flex h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 transition"
          >
            <span className="type-label min-w-[1.25rem] text-center font-semibold tracking-wide">
              {countryBarChip(countryCode)}
            </span>
            <Compass
              aria-hidden
              strokeWidth={1.75}
              className={cn(
                "h-3.5 w-3.5",
                locationSet ? "text-primary" : "text-muted-foreground/50",
              )}
            />
          </button>
        </>
      )}
    </div>
  );
}
