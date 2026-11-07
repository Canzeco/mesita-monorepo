/**
 * THE ONE LABELLED BUTTON on the place screen (Pato, MESITA-2623:
 * "standardize the size of the buttons here"): 44px (the touch floor,
 * MESITA-2324), rounded-lg, 14px semibold, one line (12px until MESITA-2932:
 * "standarize the fonts here", the body and chip size now). The action row's
 * Reserve and Directions, Location's Google Maps and Ask Uber, and every
 * Links button wear it; each adds only its own fill. Its icon is
 * PLACE_BUTTON_ICON_CLASS (16px). Until MESITA-2623 Location's pair was
 * ~36px, the row's type 11px and the boxes' icons 14px.
 */
export const PLACE_BUTTON_CLASS =
  "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition active:scale-[0.99]";

/** The glyph inside a PLACE_BUTTON_CLASS button. */
export const PLACE_BUTTON_ICON_CLASS = "h-4 w-4 shrink-0";

/**
 * THE PLACE PROFILE'S SCALE (Pato, MESITA-2636: "standardize everything
 * there, the colors the fonts the styles the sizes the spacings"). Inter only
 * on the place screen (an <h3> would otherwise inherit the app's serif
 * display face), and no host `type-*` utility: the three apps define them,
 * but this package must not depend on host CSS (MESITA-3379); achromatic (a
 * brand's own logo is the only colour).
 *
 * THE RADIUS LADDER (MESITA-3379, after ~60 one-card PRs had drifted it):
 *   card      rounded-xl (12px, one step down from 16px, MESITA-3325), p-4,
 *             12px inside; the gift cards on Rewards are cards too
 *   inside    rounded-lg: every button, tile, list, map and icon box inside
 *             a card; the one labelled button above is one of these
 *   pill      rounded-md: a small badge on a tile or card (PLACE_PILL_CLASS),
 *             a 20px mark; never a card's or a button's corner
 *   screen    the empty-state tile (PLACE_EMPTY_ICON_CLASS) is a screen-level
 *             element and keeps rounded-xl; inside a Box the caller adds
 *             rounded-lg
 * Type: 12 (meta, pill) · 13 (chip, strip) · 14 (body, button) · 16 (title)
 * · 18 (screen title) · 24 (PLACE_FIGURE_CLASS, the one big number). A
 * component never adds a size of its own.
 * Spacing: 16px sides; 16px under the sticky strip (12 + the strip's mb-1,
 * ProfileActions.tsx); 12px between cards. One row literal lives outside
 * this file: HOURS_ROW_CLASS in location-hours.tsx, next to the summary and
 * tile constants the skeleton already reads (MESITA-2701).
 */
/** A card's title: sentence case, 16px semibold ink. */
export const PLACE_TITLE_CLASS =
  "text-foreground font-sans text-base font-semibold tracking-tight";
/** Prose and primary facts inside a card: 14px ink. */
export const PLACE_BODY_CLASS = "text-foreground text-sm leading-relaxed";
/** A secondary line: 12px muted. */
export const PLACE_META_CLASS = "text-muted-foreground text-xs leading-snug";
/** Information, never a button: 1px hairline, no fill, 32px. Tags and
 *  Mesita Families both wear it (MESITA-2932). */
// BETWEEN THE TWO (Pato, MESITA-3332: "make the tags a bit larger, in
// between from this and past version"): 13px on a 30px chip; MESITA-3325
// had 12px on 28px ("a bit smaller, just a bit"), MESITA-2636 14px on
// 32px. Families and Tags wear the same box, so they follow.
export const PLACE_OUTLINE_CHIP_CLASS =
  "border-border text-foreground inline-flex h-[30px] min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium whitespace-nowrap tabular-nums";
/** A screen-level title (Soon, vote, creating): Inter 18px semibold. */
export const PLACE_SCREEN_TITLE_CLASS =
  "text-foreground font-sans text-lg font-semibold tracking-tight";
/** The small badge on a tile or card (the ink pill under Prepay and Pay, a
 *  gift card's bonus): 12px bold, 2px vertical pad, rounded-md. No fill of
 *  its own; the site adds it. ONE SHAPE (MESITA-3379; three until then). */
export const PLACE_PILL_CLASS =
  "rounded-md px-1.5 py-0.5 text-xs leading-none font-bold tabular-nums";
/** The one big number a card may show (Stats, the cashback figure, the
 *  no-photo initial): 24px, one line box, no ink of its own, like
 *  PLACE_BUTTON_CLASS carries no fill; the site adds the colour (MESITA-3379;
 *  the initial was 30px, the Stats line 32px tall). */
export const PLACE_FIGURE_CLASS = "text-2xl leading-none font-semibold tabular-nums";
/** The empty state's tile: a 56px grey square with a 28px ink glyph
 *  (MESITA-3379; the failed-create band and the Menu box drew 48px circles).
 *  Screen-level, so rounded-xl; the one site inside a Box (menus.tsx) adds
 *  rounded-lg, the ladder's in-card corner. */
export const PLACE_EMPTY_ICON_CLASS =
  "bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-xl";

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
