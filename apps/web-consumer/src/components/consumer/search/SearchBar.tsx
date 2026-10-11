"use client";

import type { RefObject } from "react";
import { Search, X } from "lucide-react";

// The Search map's query field — the one search bar in the app. Query
// field only: Places scope + Family + Popularity live in the Filters sheet,
// opened as a labelled third of the row beside this.
type SearchBarProps = {
  query: string;
  showClear: boolean;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  /** Defaults to the discovery wording. */
  placeholder?: string;
  onFocus?: () => void;
  /** Paired with onFocus by hosts that put chrome aside while the bar is live. */
  onBlur?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export function SearchBar({
  query,
  showClear,
  onQueryChange,
  onFocus,
  onBlur,
  onClear,
  placeholder = "Search places…",
  inputRef,
}: SearchBarProps) {
  // h-11, NOT h-12: 44px is the touch-target floor, so this is as short as the
  // bar goes. It matched the filter pill that used to sit beside it — two pills
  // of different heights in one row read as a misalignment.
  return (
    <div className="border-border bg-card/95 shadow-elev flex h-11 shrink-0 items-center rounded-full border pl-4 backdrop-blur-xl">
      <Search className="text-muted-foreground h-4 w-4 shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        // ENTER DISMISSES THE KEYBOARD. Results are live-searched on every
        // keystroke, so there is nothing to submit — but a return key that
        // visibly does nothing reads as a broken field, and on a phone the
        // keyboard is covering the results the guest just asked for.
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        // THE MOBILE KEYBOARD, told what this field is. Place names are not
        // prose: iOS otherwise capitalises the first letter, autocorrects
        // "Tec" to "Tech" mid-query, and floats the QuickType strip ("I ·
        // The · I'm") over the results — a fourth row of chrome on a screen
        // the keyboard already halved.
        //
        // `enterKeyHint` relabels the return key Search. NOT `type="search"`:
        // that adds WebKit's own clear button beside the X this bar already
        // draws, and two clears in one pill is worse than none.
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
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
    </div>
  );
}
