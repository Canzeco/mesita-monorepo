import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

// THE CAROUSEL'S FIRST CARD IS ADD A PLACE (Pato, MESITA-2879: "the item at
// the left must be to add new place if not in Mesita"). Always the first
// row, above the places; the rail scrolls vertically and rests on place #1,
// so this card waits above (MESITA-2880). It is two rows tall: two
// RailCards and the gap between them. Dashed and photo-less so it never reads as a place.
// A tap focuses the search bar, the old `+` disc's path (MESITA-2876): a
// guest adds a place by searching Google and tapping the result.

/** Two 8.375rem RailCards and the page's 0.375rem gap (a rail row's pb-1.5). */
const ADD_CARD_HEIGHT_CLASS = "h-[17.125rem]";

export function AddPlaceRailCard({
  empty = false,
  onAdd,
}: {
  /** The map area has no places: the card says so (MESITA-2879). */
  empty?: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        ADD_CARD_HEIGHT_CLASS,
        "border-border bg-muted/95 shadow-elev focus-visible:border-foreground flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 text-center backdrop-blur transition outline-none active:scale-[0.99]",
      )}
      data-search-add-card
    >
      <span className="bg-card text-foreground flex h-12 w-12 items-center justify-center rounded-full">
        <Plus aria-hidden className="h-6 w-6" strokeWidth={2} />
      </span>
      <span className="text-foreground mt-1 text-base font-semibold">
        {empty ? "Nothing on Mesita here yet" : "Not on Mesita?"}
      </span>
      <span className="text-muted-foreground text-sm">
        Add any place from Google
      </span>
      <span className="bg-primary text-primary-foreground mt-2 flex h-9 items-center rounded-full px-4 text-sm font-semibold">
        Add a place
      </span>
    </button>
  );
}
