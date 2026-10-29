// Search header's one token set. FLOATING, NOT A BAND (Pato, MESITA-2996:
// "the searchbar must look more like the google one … it must have no
// background. and the categories must be floating too"): every control is a
// white pill with a soft shadow, sitting straight on the map like Google
// Maps' search box and chips. MESITA-2413/2469's white band with grey fills
// is gone.
//
// THREE SEPARATE CONTROLS on row one (Pato, MESITA-3009: "return to the
// three buttons: location at the left, searchbar, ask ai at the right, all
// separated"; MESITA-2999 had put Ask AI and locate inside one long bar):
// the 48px locate disc, the 48px search bar, the 48px white Ask AI pill
// (MESITA-3010). Under them the 32px chip row, opening with a white icon-only Filters disc (MESITA-3006). Two heights (MESITA-2996, reverses MESITA-2445).
//
// The border stays as `border-transparent` so keyboard focus can darken it
// without the control shifting a pixel.
//
//   (⌖) [ ⚲ Search places…   ] (✨ Ask AI)      ← HEADER_DISC · BAR (SearchBar) · HEADER_PILL
//   (≡) (☆ Top) (○ Coffee) …                    ← CHIP_DISC · CHIP + CHIP_ON / CHIP_OFF
//
// A leaf module with no imports, so Home's header can adopt it later.

/** The floating surface every header control shares: white, and
 *  `shadow-float`, Google Maps' lift (MESITA-2998: the one-off soft shadow
 *  before it barely read over a pale map). */
export const FLOAT = "bg-card text-foreground shadow-float";

/** The search bar: the floating pill that holds the query field; typing
 *  darkens its border. */
export const BAR = `${FLOAT} border-transparent focus-within:border-foreground flex h-12 min-w-0 items-center gap-1 rounded-full border pr-1 pl-4 transition-colors`;

/** The locate disc: a 48px floating white disc left of the bar, the bar's
 *  height (Pato, MESITA-3009: "location at the left"; right of the bar in
 *  MESITA-3006, under the chips in MESITA-3005). */
export const HEADER_DISC = `${FLOAT} border-transparent hover:bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

/** Ask AI right of the bar, its own floating 48px control (MESITA-3009): a
 *  white pill with ink text and sparkles, the locate disc's look widened
 *  (Pato, MESITA-3010: "remove the black color from ask ai"; MESITA-3007's
 *  black pill, MESITA-3003's tint and MESITA-3000's gradient are gone). */
export const HEADER_PILL = `${FLOAT} border-transparent hover:bg-muted flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

/** The Filters disc at the chip row's left: a chip's 32px, round, icon
 *  only (MESITA-3006). */
export const CHIP_DISC = `${FLOAT} border-transparent hover:bg-muted relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

export const CHIP =
  "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold whitespace-nowrap transition outline-none focus-visible:border-foreground active:scale-[0.97]";
/** A dark border is invisible on the ink chip, and the nav's overflow clips
 *  an outer ring: the selected chip focuses with an inset ring. */
export const CHIP_ON =
  "border-primary bg-primary text-primary-foreground shadow-float focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground";
/** An unpicked chip on the map: the floating white pill. */
export const CHIP_OFF = `${FLOAT} border-transparent hover:bg-muted`;
/** An unpicked chip inside a sheet (already on white): a grey fill. */
export const CHIP_OFF_FLAT =
  "border-transparent bg-muted text-foreground hover:bg-border";
