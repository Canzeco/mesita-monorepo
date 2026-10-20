"use client";

import type { RefObject } from "react";
import { Search, X } from "lucide-react";

// The Search map's query field — the one search bar in the app, between the
// locate and Ask AI discs. Query field only: the chip row under it picks
// Nearby, Popular or a family (MESITA-2426). Same outline as every header
// control (header-classes.ts): flat, no shadow, a dark border while focused.
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
  // h-9, like every header control (MESITA-2445); the discs and chips
  // match — two heights in one row read as a misalignment. A grey fill with
  // no outline, iOS's and Instagram's search field (MESITA-2469); typing
  // darkens the border.
  return (
    <div className="bg-muted focus-within:border-foreground flex h-9 shrink-0 items-center rounded-full border border-transparent pl-4 transition-colors">
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
        // A fixed name, not the placeholder: a screen reader should not read
        // "Search places dot dot dot" (MESITA-2433).
        aria-label="Search places"
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
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-3 text-sm font-medium outline-none"
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground focus-visible:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition outline-none"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
