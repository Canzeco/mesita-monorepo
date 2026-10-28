import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";

import { RAIL_CARD_HEIGHT_CLASS } from "./SearchRailCard";

// ADD A PLACE IS THE CAROUSEL'S FIRST CARD (Pato, MESITA-2886: "the normal
// horizontal carousel but if you scroll to the left, you see a box to add a
// new place"). Page 0; the carousel rests on place #1, so it waits off-screen
// to the left. A tap opens AddPlaceSheet (MESITA-2902): a Google search
// whose row button creates the profile (consumer-web-create-place).
//
// A CENTRED, FAST BUTTON, THE CARD'S SIZE (Pato, MESITA-2904: "it must be all
// centered … add a new place in less than 10 seconds … it must look super
// fast · the only thing that must remain the same is the size of the box").
// RailCard's height and the page's width; no photo slot (MESITA-2889 had
// drawn it as a place card). Ink fill and white text, the primary-button
// look, with a bolt for speed.

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
        "bg-foreground text-paper shadow-elev focus-visible:ring-primary flex w-full flex-col items-center justify-center gap-2 rounded-2xl px-5 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]",
      )}
      data-search-add-button
    >
      <span className="bg-paper/15 flex h-10 w-10 items-center justify-center rounded-full">
        <Zap aria-hidden className="h-5 w-5 fill-current" strokeWidth={2} />
      </span>
      <span className="font-sans text-base leading-5 font-semibold tracking-tight">
        Add a new place to Mesita
      </span>
      <span className="text-paper/70 text-sm leading-5">
        {empty
          ? "Nothing on Mesita here yet. Add it in under 10 seconds."
          : "Not on Mesita yet? Add it in under 10 seconds."}
      </span>
    </button>
  );
}
