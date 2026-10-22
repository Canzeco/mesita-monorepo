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

/**
 * THE PLACE PROFILE'S SCALE (Pato, MESITA-2636: "standardize everything
 * there, the colors the fonts the styles the sizes the spacings"). Inter only
 * on the place screen (an <h3> would otherwise inherit the app's serif
 * display face); achromatic (a brand's own logo is the only colour); cards
 * rounded-2xl with p-4 and 12px inside, everything inside a card rounded-lg.
 */
/** A card's title: sentence case, 16px semibold ink. */
export const PLACE_TITLE_CLASS =
  "text-foreground font-sans text-base font-semibold tracking-tight";
/** Prose and primary facts inside a card: 14px ink. */
export const PLACE_BODY_CLASS = "text-foreground text-sm leading-relaxed";
/** A secondary line: 12px muted. */
export const PLACE_META_CLASS = "text-muted-foreground text-xs leading-snug";
/** Information, never a button: 1px hairline, no fill, 32px. */
export const PLACE_OUTLINE_CHIP_CLASS =
  "border-border text-foreground inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium whitespace-nowrap tabular-nums";
/** A screen-level title (Soon, vote, creating): Inter 18px semibold. */
export const PLACE_SCREEN_TITLE_CLASS =
  "text-foreground font-sans text-lg font-semibold tracking-tight";

/**
 * A block of the place screen that has not loaded yet (Pato, MESITA-2701:
 * "the placeholders must be similar to the page you are loading, like the
 * sizes"): the consumer's Skeleton look (bg-muted, pulsing, rounded-lg),
 * which the package cannot import. The skeleton's bones and the top bar's
 * pending name both wear it.
 */
export const PLACE_BONE_CLASS = "bg-muted animate-pulse rounded-lg";

export const ERROR_BOX_CLASS =
  "rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive";
