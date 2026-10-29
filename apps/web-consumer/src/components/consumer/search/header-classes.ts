// Search header's one token set. FLOATING, NOT A BAND (Pato, MESITA-2996:
// "the searchbar must look more like the google one … it must have no
// background. and the categories must be floating too"): every control is a
// white pill with a soft shadow, sitting straight on the map like Google
// Maps' search box and chips. MESITA-2413/2469's white band with grey fills
// is gone.
//
// ONE LONG BAR (Pato, MESITA-2999: "the searchbar must be long. so put the
// ask ai inside the searchbar … same for location"; then "search · ask
// bubble · loc bubble"): a 48px pill across the screen holding the query
// field, then Ask AI as a black pill inside it (MESITA-3007); the locate disc sits
// right of the bar on the same row (MESITA-3006). Under it the
// 32px chip row, opening with a white icon-only Filters disc (MESITA-3006). Two heights (MESITA-2996, reverses MESITA-2445).
//
// The border stays as `border-transparent` so keyboard focus can darken it
// without the control shifting a pixel.
//
//   [ ⚲ Search places…      (✦ Ask AI) ] (⌖)   ← BAR: SearchBar · HEADER_PILL · HEADER_DISC
//   (≡) (☆ Top) (○ Coffee) …                    ← CHIP_DISC · CHIP + CHIP_ON / CHIP_OFF
//
// A leaf module with no imports, so Home's header can adopt it later.

/** The floating surface every header control shares: white, and
 *  `shadow-float`, Google Maps' lift (MESITA-2998: the one-off soft shadow
 *  before it barely read over a pale map). */
export const FLOAT = "bg-card text-foreground shadow-float";

/** The one long bar: the floating pill that holds the query field and the
 *  Ask AI pill; typing darkens its border. */
export const BAR = `${FLOAT} border-transparent focus-within:border-foreground flex h-12 min-w-0 items-center gap-1 rounded-full border pr-1.5 pl-4 transition-colors`;

/** The locate disc: a 48px floating white disc right of the bar, the bar's
 *  height (Pato, MESITA-3006: "the location at top right at the same
 *  level"; MESITA-3005 had it under the chips). */
export const HEADER_DISC = `${FLOAT} border-transparent hover:bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

/** Ask AI at the bar's right end: the bar's one strong control, a black pill
 *  with white text (Pato, MESITA-3007: "ask ai must be stronger … more
 *  notable"; it was the grey bubble, after MESITA-3000's gradient
 *  "screaming" and MESITA-3003's tint). The selected chip's ink, so no new
 *  colour enters the app. */
export const HEADER_PILL =
  "bg-primary text-primary-foreground flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.97]";

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
