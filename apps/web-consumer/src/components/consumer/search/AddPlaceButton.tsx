import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";

import { RAIL_CARD_HEIGHT_CLASS } from "./SearchRailCard";

// ADD A PLACE IS THE CAROUSEL'S FIRST CARD (Pato, MESITA-2886: "the normal
// horizontal carousel but if you scroll to the left, you see a box to add a
// new place"). Page 0; the carousel rests on place #1, so it waits off-screen
// to the left. A tap opens AddPlaceSheet (MESITA-2902): a Google search
// whose row button creates the profile (consumer-web-create-place).
//
// A CENTRED, FAST CARD WITH A REAL BUTTON (Pato, MESITA-2904: "it must be all
// centered … add a new place in less than 10 seconds … the only thing that
// must remain the same is the size of the box"; MESITA-2905: "must have
// something that looks as a button and must be centered"). RailCard's
// height and the page's width, an ink fill; a centred headline, a line, and
// a white pill button with a bolt. The whole card is the tap target.

export function AddPlaceButton({
  onAdd,
  empty = false,
}: {
  onAdd: () => void;
  /** No places in this area: the line says so. */
  empty?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        RAIL_CARD_HEIGHT_CLASS,
        "group bg-foreground text-paper shadow-elev focus-visible:ring-primary flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-5 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      )}
      data-search-add-button
    >
      <span className="font-sans text-base leading-5 font-semibold tracking-tight">
        Add a new place to Mesita
      </span>
      <span className="text-paper/70 text-sm leading-5">
        {empty
          ? "Nothing here yet. Takes under 10 seconds."
          : "Not on Mesita yet? Takes under 10 seconds."}
      </span>
      <span
        className="bg-paper text-foreground mt-2 flex h-9 items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition group-active:scale-[0.96]"
        data-search-add-cta
      >
        <Zap aria-hidden className="h-4 w-4 fill-current" strokeWidth={2} />
        Add a place
      </span>
    </button>
  );
}
