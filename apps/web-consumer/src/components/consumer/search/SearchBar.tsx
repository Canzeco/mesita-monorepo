"use client";

import type { RefObject } from "react";
import { Search, X } from "lucide-react";

import { HEADER_ICON, HEADER_ICON_STROKE, HEADER_TEXT } from "./header-classes";

// The Search map's query field — the one search bar in the app, the left
// part of SearchHeader's long bar, before Ask AI and locate (MESITA-2999).
// Query field only: the Filters sheet picks the family (MESITA-2875). The
// pill (BAR in header-classes.ts) is SearchHeader's; this is its content.
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
  // Fills what Ask AI and locate leave in the bar (MESITA-2999).
  return (
    <div className="flex h-full min-w-0 flex-1 items-center">
      <Search
        className={`text-muted-foreground ${HEADER_ICON}`}
        strokeWidth={HEADER_ICON_STROKE}
      />
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
        className={`placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-3 ${HEADER_TEXT} outline-none`}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground focus-visible:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition outline-none"
        >
          <X className={HEADER_ICON} strokeWidth={HEADER_ICON_STROKE} />
        </button>
      )}
    </div>
  );
}
