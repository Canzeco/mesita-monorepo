// Search header's one token set. A WHITE TOP HEADER, FLOATING CHIPS (Pato,
// MESITA-3019: "make a top header for the searchbar … location searchbar and
// ask ai with white background, then the filters and categories actually
// floating"). Row one sits in a white band with a 1px hairline under it, its
// three controls grey-filled on the white (white on white would vanish). The
// chip row under it stays floating white pills with a shadow over the map,
// as MESITA-2996 made every control.
//
// THREE SEPARATE CONTROLS on row one (Pato, MESITA-3009: "return to the
// three buttons: location at the left, searchbar, ask ai at the right, all
// separated"; MESITA-2999 had put Ask AI and locate inside one long bar):
// the 40px locate disc, the 40px search bar, the 40px white Ask AI pill
// (MESITA-3010). Under them the 32px chip row, opening with a white icon-only Filters disc (MESITA-3006). Two heights (MESITA-2996, reverses MESITA-2445).
//
// The border stays as `border-transparent` so keyboard focus can darken it
// without the control shifting a pixel.
//
//   ┌ (⌖) [ ⚲ Search places…   ] (✨ Ask AI) ┐ ← HEADER_BAND: HEADER_DISC · BAR (SearchBar) · HEADER_PILL
//   └────────────────────────────────────────┘
//   (≡) (☆ Top) (○ Coffee) …   over the map    ← CHIP_DISC · CHIP + CHIP_ON / CHIP_OFF
//
// A leaf module with no imports, so Home's header can adopt it later.

/** The floating surface every header control shares: white, and
 *  `shadow-float`, Google Maps' lift (MESITA-2998: the one-off soft shadow
 *  before it barely read over a pale map). */
export const FLOAT = "bg-card text-foreground shadow-float";

/** Row one's white band across the top of the map, a 1px hairline under it
 *  (MESITA-3019), Home's header surface. */
export const HEADER_BAND = "bg-card border-border border-b";

/** A control inside the white band: a grey fill, no shadow. */
const IN_BAND = "bg-muted text-foreground border-transparent";

/** The search bar: the grey pill in the band that holds the query field;
 *  typing darkens its border. */
export const BAR = `${IN_BAND} focus-within:border-foreground flex h-10 min-w-0 items-center gap-1 rounded-full border pr-1 pl-4 transition-colors`;

/** The locate disc: a 40px (MESITA-3022; was 48) floating white disc left of the bar, the bar's
 *  height (Pato, MESITA-3009: "location at the left"; right of the bar in
 *  MESITA-3006, under the chips in MESITA-3005). */
export const HEADER_DISC = `${IN_BAND} hover:bg-border flex h-10 w-10 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

/** Ask AI right of the bar, its own floating 40px control (MESITA-3009; 48 until MESITA-3022): a
 *  white pill with ink text and sparkles, the locate disc's look widened
 *  (Pato, MESITA-3010: "remove the black color from ask ai"; MESITA-3007's
 *  black pill, MESITA-3003's tint and MESITA-3000's gradient are gone). */
export const HEADER_PILL = `${IN_BAND} hover:bg-border flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

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
