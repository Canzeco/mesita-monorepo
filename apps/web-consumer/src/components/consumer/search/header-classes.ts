// Search header's one token set (Pato, MESITA-2433): every control is h-9
// (36px): the discs, the bar AND the chips (Pato, MESITA-2443 "a bit shorter
// btw rows", then MESITA-2445 "searchbar and category must be same height"), a grey fill with no outline, text-sm, and a dark border when focused from
// the keyboard. No shadow and no blur on a control: the header is a white
// band, not a float over the map. The band itself keeps Home's `bg-card/95`
// (SearchHeader).
//
// FILLED, NOT OUTLINED (Pato, MESITA-2469: "think the apple or instagram
// aesthetic"). iOS and Instagram draw a control as a grey fill on white with
// no outline; the border stays as `border-transparent` so keyboard focus can
// still darken it without the control shifting a pixel.
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ✦ )   ← HEADER_DISC · SearchBar · HEADER_DISC
//   (📍 Nearby) (⭐ Popular) │ (☕ Coffee) …   ← CHIP + CHIP_ON / CHIP_OFF
//
// A leaf module with no imports, so Home's header can adopt it later.

/** The 36px disc at each end of the bar's row: locate and Ask AI. */
export const HEADER_DISC =
  "border-transparent bg-muted text-foreground hover:bg-border flex h-9 w-9 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]";

/** Ask AI at the bar's right end: the disc's outline and height, widened
 *  into a pill that says what it does (Pato, MESITA-2455: "the ask AI
 *  button must be wider"; it was a 36px icon disc, MESITA-2433). */
export const HEADER_PILL =
  "border-transparent bg-muted text-foreground hover:bg-border flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold whitespace-nowrap outline-none transition focus-visible:border-foreground active:scale-[0.97]";

export const CHIP =
  "flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold whitespace-nowrap transition outline-none focus-visible:border-foreground active:scale-[0.97]";
/** A dark border is invisible on the ink chip, and the nav's overflow clips
 *  an outer ring: the selected chip focuses with an inset ring. */
export const CHIP_ON =
  "border-primary bg-primary text-primary-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground";
export const CHIP_OFF =
  "border-transparent bg-muted text-foreground hover:bg-border";
