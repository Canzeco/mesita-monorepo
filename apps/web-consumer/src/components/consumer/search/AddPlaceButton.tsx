import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

// ADD A PLACE IS A BUTTON AT THE CAROUSEL'S LEFT (Pato, MESITA-2882: "the
// add place is a button at the left"). Pinned outside the scroll, the pages'
// height, so it never slides away and never takes a page: MESITA-2879 had
// drawn it as the carousel's page 0, a whole dashed card. Dashed and
// photo-less so it never reads as a place. A tap focuses the search bar,
// the old `+` disc's path (MESITA-2876): a guest adds a place by searching
// Google and tapping the result.

/** Two 8.375rem RailCards and the page's 0.375rem gap (RAIL_PAGE's gap-1.5):
 *  the button stands as tall as a page. */
export const ADD_BUTTON_HEIGHT_CLASS = "h-[17.125rem]";

export function AddPlaceButton({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label="Add a place"
      className={cn(
        ADD_BUTTON_HEIGHT_CLASS,
        "border-border bg-muted/95 shadow-elev focus-visible:border-foreground flex w-14 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed backdrop-blur transition outline-none active:scale-[0.97]",
      )}
      data-search-add-button
    >
      <span className="bg-card text-foreground flex h-10 w-10 items-center justify-center rounded-full">
        <Plus aria-hidden className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="text-foreground text-xs font-semibold">Add</span>
    </button>
  );
}
