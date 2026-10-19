// Search header's one token set (Pato, MESITA-2433): every control is h-11,
// a flat 1px outline on white, text-sm, and a dark border when focused from
// the keyboard. No shadow and no blur on a control: the header is a white
// band, not a float over the map. The band itself keeps Home's `bg-card/95`
// (SearchHeader).
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ✦ )   ← HEADER_DISC · SearchBar · HEADER_DISC
//   (📍 Nearby) (⭐ Popular) │ (☕ Coffee) …   ← CHIP + CHIP_ON / CHIP_OFF
//
// A leaf module with no imports, so Home's header can adopt it later.

/** The 44px disc at each end of the bar's row: locate and Ask AI. */
export const HEADER_DISC =
  "border-border bg-card text-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]";

export const CHIP =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition outline-none focus-visible:border-foreground active:scale-[0.97]";
/** A dark border is invisible on the ink chip, and the nav's overflow clips
 *  an outer ring: the selected chip focuses with an inset ring. */
export const CHIP_ON =
  "border-primary bg-primary text-primary-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground";
export const CHIP_OFF = "border-border bg-card text-foreground hover:bg-muted";
