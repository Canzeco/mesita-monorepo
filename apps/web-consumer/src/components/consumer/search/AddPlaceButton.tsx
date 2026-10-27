import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

// ADD A PLACE IS THE CAROUSEL'S FIRST CARD (Pato, MESITA-2886: "the normal
// horizontal carousel but if you scroll to the left, you see a box to add a
// new place", "same size as all the items"). Page 0, a RailCard's size; the
// carousel rests on place #1, so it waits off-screen to the left. MESITA-2885
// had pinned it beside the rail, 56px wide. Dashed and photo-less so it never
// reads as a place. A tap puts the bar in Add mode (SearchClient): Google's
// names for a place not yet on Mesita, and a pick opens the opening screen,
// which calls consumer-web-create-place.

/** A RailCard's height (SearchRailCard's RAIL_CARD_HEIGHT_CLASS). */
const ADD_CARD_HEIGHT_CLASS = "h-[8.375rem]";

export function AddPlaceButton({
  onAdd,
  empty = false,
}: {
  onAdd: () => void;
  /** No places in this area: the card says so. */
  empty?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label="Add a place"
      className={cn(
        ADD_CARD_HEIGHT_CLASS,
        "border-border bg-muted/95 shadow-elev focus-visible:border-foreground flex w-full items-center gap-3 rounded-2xl border-2 border-dashed px-4 text-left backdrop-blur transition outline-none active:scale-[0.98]",
      )}
      data-search-add-button
    >
      <span className="bg-card text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
        <Plus aria-hidden className="h-6 w-6" strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground text-base font-semibold">
          Add a place
        </span>
        <span className="text-muted-foreground text-sm">
          {empty
            ? "Nothing on Mesita here yet. Add the first one."
            : "Not on Mesita yet? Create its profile."}
        </span>
      </span>
    </button>
  );
}
