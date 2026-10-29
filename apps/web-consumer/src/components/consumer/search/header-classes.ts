// Search header's one token set. FLOATING, NOT A BAND (Pato, MESITA-2996:
// "the searchbar must look more like the google one … it must have no
// background. and the categories must be floating too"): every control is a
// white pill with a soft shadow, sitting straight on the map like Google
// Maps' search box and chips. MESITA-2413/2469's white band with grey fills
// is gone.
//
// TWO HEIGHTS (MESITA-2996: "must not have the same height as the
// searchbar"; reverses MESITA-2445): the bar's row is h-11 (44px) — the
// locate disc, the bar, Ask AI — and the chip row is h-8 (32px).
//
// The border stays as `border-transparent` so keyboard focus can darken it
// without the control shifting a pixel.
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ✦ Ask AI )   ← HEADER_DISC · SearchBar · HEADER_PILL
//   (≡) (☆ Top) (○ Coffee) …                    ← CHIP_DISC · CHIP + CHIP_ON / CHIP_OFF
//
// A leaf module with no imports, so Home's header can adopt it later.

/** The floating surface every header control shares: white, a soft shadow. */
export const FLOAT =
  "bg-card text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.18)]";

/** The 44px disc at the left of the bar's row: locate. */
export const HEADER_DISC = `${FLOAT} border-transparent hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

/** Ask AI at the bar's right end: the disc's height, widened into a pill
 *  that says what it does (Pato, MESITA-2455). */
export const HEADER_PILL = `${FLOAT} border-transparent hover:bg-muted flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

/** The Filters disc at the chip row's left: a chip's 32px, round. */
export const CHIP_DISC = `${FLOAT} border-transparent hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

export const CHIP =
  "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold whitespace-nowrap transition outline-none focus-visible:border-foreground active:scale-[0.97]";
/** A dark border is invisible on the ink chip, and the nav's overflow clips
 *  an outer ring: the selected chip focuses with an inset ring. */
export const CHIP_ON =
  "border-primary bg-primary text-primary-foreground shadow-[0_1px_4px_rgba(0,0,0,0.18)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground";
/** An unpicked chip on the map: the floating white pill. */
export const CHIP_OFF = `${FLOAT} border-transparent hover:bg-muted`;
/** An unpicked chip inside a sheet (already on white): a grey fill. */
export const CHIP_OFF_FLAT =
  "border-transparent bg-muted text-foreground hover:bg-border";
