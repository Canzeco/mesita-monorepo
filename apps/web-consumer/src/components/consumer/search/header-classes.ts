// Search header's one token set. NO BAND (Pato, 2026-11-23, MESITA-4799: "I
// want to make the searchbar background transparent" … "put the askai button
// joined to the searchbar"; MESITA-3019 had a white band, MESITA-3009 a
// separate Ask AI): the map runs to the screen top, and the bar, the chips
// and locate are white floating pills with one shadow.
//
// The border stays as `border-transparent` so keyboard focus can darken it
// without the control shifting a pixel.
//
//   [ ⚲ Search places…          │ ✦ AI ]   ← SEARCH_BAR (SearchBar + BAR_ACTION)
//   [▦ Menu] (☆ Popular) (○ Coffee) …      ← CHIP_SPECIAL · CHIP + CHIP_ON / CHIP_OFF
//
// 1.5 TO 1 (Pato, 2026-11-23, MESITA-4811: "1.5 and 1 is the best"): the
// bar 48px, the chips 32px. LOCATE IS MAP_DISC, 48px at the map's bottom
// right over the cards, Google Maps' own place for it. Pay's bar (BAR) and
// Tickets (HEADER_PILL) sit on white, so they stay grey.
//
// A leaf module with no imports, so Home's header can adopt it later.

/** ONE TYPE AND ONE ICON SIZE across the header (Pato, MESITA-3023:
 *  "standarize the fonts and sizes"): every label and the bar's text are
 *  14px semibold; every icon is 16px at stroke 2, lit or not. */
export const HEADER_TEXT = "text-sm font-semibold";
export const HEADER_ICON = "h-4 w-4 shrink-0";
export const HEADER_ICON_STROKE = 2;

/** The floating surface every header control shares: white, and
 *  `shadow-float`, Google Maps' lift (MESITA-2998: the one-off soft shadow
 *  before it barely read over a pale map). */
export const FLOAT = "bg-card text-foreground shadow-float";

/** A control on a white header (Pay): a grey fill, no shadow. */
const IN_BAND = "bg-muted text-foreground border-transparent";

/** Pay's search bar: a grey pill on white; typing darkens its border. */
export const BAR = `${IN_BAND} focus-within:border-foreground flex h-10 min-w-0 items-center gap-1 rounded-full border pr-1 pl-4 transition-colors`;

/** Search's bar on the map: a white floating pill holding the query field
 *  and, at its right end, Ask AI (MESITA-4799). `overflow-hidden` clips the
 *  AI end to the pill's round corner. */
export const SEARCH_BAR = `${FLOAT} border-transparent focus-within:border-foreground flex h-12 min-w-0 items-stretch overflow-hidden rounded-full border pl-4 transition-colors`;

/** Ask AI, the bar's right end: the full 48px tall, a hairline before it. */
export const BAR_ACTION = `border-border hover:bg-muted focus-visible:bg-muted active:bg-muted flex shrink-0 items-center justify-center gap-1.5 border-l pr-5 pl-4 ${HEADER_TEXT} whitespace-nowrap outline-none transition-colors`;

/** A labelled 40px grey pill: Pay's Tickets shortcut. */
export const HEADER_PILL = `${IN_BAND} hover:bg-border flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 ${HEADER_TEXT} whitespace-nowrap outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

/** Locate, at the map's bottom right: the bar's 48px, round, icon only
 *  (MESITA-4811). */
export const MAP_DISC = `${FLOAT} border-transparent hover:bg-muted relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:border-foreground active:scale-[0.97]`;

export const CHIP = `flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 ${HEADER_TEXT} whitespace-nowrap transition outline-none focus-visible:border-foreground active:scale-[0.97]`;
/** MENU IS THE ONE SQUARE ON THE MAP (MESITA-4466, MESITA-4468: "only
 *  popular too rounded"): Menu is a rounded square, Popular and every
 *  family chip are pills. */
export const CHIP_SPECIAL = CHIP.replace("rounded-full", "rounded-lg");
/** A dark border is invisible on the ink chip, and the nav's overflow clips
 *  an outer ring: the selected chip focuses with an inset ring. */
export const CHIP_ON =
  "border-primary bg-primary text-primary-foreground shadow-float focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground";
/** An unpicked chip on the map: the floating white pill. */
export const CHIP_OFF = `${FLOAT} border-transparent hover:bg-muted`;
/** An unpicked chip inside a sheet (already on white): a grey fill. */
export const CHIP_OFF_FLAT =
  "border-transparent bg-muted text-foreground hover:bg-border";

/** The count bubble on the Filters disc's top-right corner while families
 *  are picked (MESITA-3006), ringed in white so it reads off the disc; the
 *  caller gives its colour (red since MESITA-3216). Search's and Home's
 *  Filters discs share it (MESITA-3666). */
export const DISC_BADGE =
  "bg-primary text-primary-foreground ring-card absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center type-meta rounded-full px-1 leading-none font-semibold ring-2";
