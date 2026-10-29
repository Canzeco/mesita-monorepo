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
// field, then Ask AI and locate as small grey bubbles inside it. Under it the
// 32px chip row, opening with a worded Filters chip (MESITA-2999: "filters,
// not only the icon"). Two heights (MESITA-2996, reverses MESITA-2445).
//
// The border stays as `border-transparent` so keyboard focus can darken it
// without the control shifting a pixel.
//
//   [ ⚲ Search places…      (✦ Ask AI) (⌖) ]   ← BAR: SearchBar · HEADER_PILL · HEADER_DISC
//   (≡ Filters) (☆ Top) (○ Coffee) …            ← CHIP + CHIP_ON / CHIP_OFF
//
// A leaf module with no imports, so Home's header can adopt it later.

/** The floating surface every header control shares: white, and
 *  `shadow-float`, Google Maps' lift (MESITA-2998: the one-off soft shadow
 *  before it barely read over a pale map). */
export const FLOAT = "bg-card text-foreground shadow-float";

/** The one long bar: the floating pill that holds the query field and the
 *  two bubbles; typing darkens its border. */
export const BAR = `${FLOAT} border-transparent focus-within:border-foreground flex h-12 min-w-0 items-center gap-1 rounded-full border pr-1.5 pl-4 transition-colors`;

/** A bubble inside the bar: shape only; each bubble brings its colour
 *  (MESITA-3000). */
const BUBBLE =
  "flex h-9 shrink-0 items-center justify-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-foreground active:scale-[0.97]";

/** The locate bubble at the bar's right end: a pale tint of the map's
 *  guest blue (MESITA-3000, paler in MESITA-3003); SearchLocateButton paints the target. */
export const HEADER_DISC = `${BUBBLE} bg-locate-tint w-9 hover:brightness-95`;

/** Ask AI, before locate: a bubble widened to say what it does
 *  (Pato, MESITA-2455), in a pale violet tint (MESITA-3003: "more discreet";
 *  MESITA-3000's gradient was "screaming"). */
export const HEADER_PILL = `${BUBBLE} bg-ai-tint text-ai-ink gap-1.5 px-3 text-sm font-semibold whitespace-nowrap hover:brightness-95`;

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
