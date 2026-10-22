/**
 * THE ONE LABELLED BUTTON on the place screen (Pato, MESITA-2623:
 * "standardize the size of the buttons here"): 44px (the touch floor,
 * MESITA-2324), rounded-lg, 12px semibold, one line. The action row's
 * Reserve and Directions, Location's Google Maps and Ask Uber, and every
 * Links button wear it; each adds only its own fill. Its icon is
 * PLACE_BUTTON_ICON_CLASS (16px). Until MESITA-2623 Location's pair was
 * ~36px, the row's type 11px and the boxes' icons 14px.
 */
export const PLACE_BUTTON_CLASS =
  "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition active:scale-[0.99]";

/** The glyph inside a PLACE_BUTTON_CLASS button. */
export const PLACE_BUTTON_ICON_CLASS = "h-4 w-4 shrink-0";

export const ERROR_BOX_CLASS =
  "rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive";
