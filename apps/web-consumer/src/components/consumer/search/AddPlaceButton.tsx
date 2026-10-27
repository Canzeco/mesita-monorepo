import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

// ADD A PLACE IS A BUTTON AT THE CAROUSEL'S LEFT (Pato, MESITA-2885: "the box
// at the left must literally be a button to add a profile if the place is
// not yet on mesita, just create place"). Pinned outside the scroll, one
// card tall, so it never slides away and never takes a page. Dashed and
// photo-less so it never reads as a place. A tap puts the bar in Add mode
// (SearchClient): Google's names for a place not yet on Mesita, and a pick
// opens the opening screen, which calls consumer-web-create-place.

/** One 8.375rem RailCard: the button stands as tall as the carousel. */
export const ADD_BUTTON_HEIGHT_CLASS = "h-[8.375rem]";

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
