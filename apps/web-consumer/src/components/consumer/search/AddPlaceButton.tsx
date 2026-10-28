import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  RAIL_CARD_FRAME,
  RAIL_CARD_HEIGHT_CLASS,
  RAIL_CARD_TEXT,
} from "./SearchRailCard";

// ADD A PLACE IS THE CAROUSEL'S FIRST CARD (Pato, MESITA-2886: "the normal
// horizontal carousel but if you scroll to the left, you see a box to add a
// new place"). Page 0; the carousel rests on place #1, so it waits off-screen
// to the left. A tap opens AddPlaceSheet (MESITA-2902): a Google search
// whose row button creates the profile (consumer-web-create-place).
//
// THE PLACE CARD'S OWN SHAPE (Pato, MESITA-2889: "same size and dimensions"):
// RailCard's frame, height and text column, read from SearchRailCard so the
// two cannot drift; the square photo slot holds a big + where a place shows
// its photo. MESITA-2886's grey dashed panel is gone.

export function AddPlaceButton({
  onAdd,
  empty = false,
}: {
  onAdd: () => void;
  /** No places in this area: the card says so. */
  empty?: boolean;
}) {
  return (
    <div className={cn(RAIL_CARD_FRAME, RAIL_CARD_HEIGHT_CLASS)}>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add a place"
        className="focus-visible:ring-primary absolute inset-0 flex items-stretch text-left outline-none focus-visible:ring-2 focus-visible:ring-inset active:opacity-80"
        data-search-add-button
      >
        <span className="bg-muted text-foreground flex aspect-square h-full w-auto shrink-0 items-center justify-center">
          <Plus aria-hidden className="h-12 w-12" strokeWidth={1.75} />
        </span>
        <span className={cn("text-foreground", RAIL_CARD_TEXT)}>
          <span className="font-sans text-base leading-5 font-semibold tracking-tight">
            Add a place
          </span>
          <span className="text-muted-foreground text-sm leading-5">
            {empty
              ? "Nothing on Mesita here yet. Add the first one."
              : "Not on Mesita yet? Create its profile."}
          </span>
        </span>
      </button>
    </div>
  );
}
