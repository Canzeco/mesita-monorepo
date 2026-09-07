// Shared Tailwind class strings for form primitives + feedback boxes.
//
// These are intentionally NOT React components — they're string constants
// so you can compose them with cn() at the call site, mix in modifiers,
// or apply them to native elements without an extra wrapper. The fields
// that DO benefit from a component (label + hint + required mark, for
// example) live in src/components/shared/Field.tsx.

// Single-line text input. Matches the visual rhythm used across every
// Mesita form: 44px tall, 12px border-radius, subtle card background,
// brand-foreground focus ring.
export const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-foreground/40";

// Destructive feedback (form errors, failed actions). Lower contrast than
// the destructive color full-strength so it reads as a notice, not an alert.
export const ERROR_BOX_CLASS =
  "rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive";

// Neutral feedback (success info, hints, "check your inbox" messages).
export const INFO_BOX_CLASS =
  "rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground";

// Primary submit button. Used for the bottom-of-form action — full-width,
// pill-shaped, dark-foreground fill. Use cn() to merge in `flex-1`, etc.
export const PRIMARY_BUTTON_CLASS =
  "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition disabled:opacity-60";

// Sheet / section heading — the display-font h2 used at the top of modals and
// page sections. Compose with cn() when a row needs extra layout classes.
export const SHEET_TITLE_CLASS =
  "font-display text-xl font-semibold tracking-tight";

// Scrollable body region under a LocalSheet / BottomSheet header — the padded
// content column every modal shares. Compose with cn() for per-sheet tweaks.
export const SHEET_BODY_CLASS =
  "scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5";

// Instagram brand badge fill used on social avatars (feed + profile modal).
export const INSTAGRAM_BADGE_GRADIENT_CLASS =
  "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5]";

// Multi-line text area — same border/type rhythm as INPUT_CLASS, without the
// fixed 44px height so rows can grow with content.
export const TEXTAREA_CLASS =
  "w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-foreground/40";

// Mesita Instagram icon tint (oklch warm→magenta) — IconCircle + verify/class UI.
export const INSTAGRAM_ICON_GRADIENT_CLASS =
  "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]";

// Secondary Cancel action used in LocalSheet footers (bordered, card fill).
export const SHEET_CANCEL_BUTTON_CLASS =
  "border-border bg-card hover:bg-muted flex-1 rounded-lg border py-3 text-sm font-semibold transition";

// Sheet grabber — the 40×4 pill that says "this pulls from the bottom".
export const SHEET_GRABBER_CLASS =
  "bg-foreground/20 mx-auto mt-2 h-1 w-10 shrink-0 rounded-full";

// THE PLACE GRID — one geometry, shared by every full-screen grid of place
// tiles: Home's Feed and Home's Favs (MESITA-1624, Pato: "saved places must
// look the same"). Two constants because the page padding and the grid are
// separate elements; a surface that takes one takes both.
//
// px-2 + gap-2 puts the grid at 359 of a 375px frame (~96%) with tiles at
// ~176px. That near-full-bleed measurement is the instruction Feed shipped on
// (MESITA-1621: "2 wide, occupying almost 100% of screen"), and Favs adopting
// it is what made these constants rather than two literals. px-0 is NOT the
// next step: a 2xl corner radius flush against the frame reads as a clipped
// render, not a full-bleed one.
//
// GRID-COLS-2 IS UNCONDITIONAL. Favs used to carry `grid-cols-1
// min-[360px]:grid-cols-2` and fell to one column on a 320px phone — the
// exact drift these constants exist to make impossible, and the reason a
// breakpoint must never come back here.
//
// CatalogRails is deliberately NOT a caller: horizontal rails under category
// headings are a different layout answering a different question, not a third
// copy of this one.
export const PLACE_GRID_CLASS = "grid grid-cols-2 gap-2";

// The scroll column a PLACE_GRID_CLASS grid sits in. Skeletons use the grid
// alone — they render inside a column that already has this padding.
export const PLACE_GRID_PAGE_CLASS = "px-2 pt-2 pb-6";

// THE TILE'S OWN RATIO, for SKELETONS ONLY. `FavoriteTile` does not read it:
// the real card is two stacked `aspect-[4/3]` boxes (photo, then body), and
// 2:3 is what those two sum to — a card built FROM this constant could not
// grow past it at large accessibility text, which the body must (MESITA-1624;
// see FavoriteTile's header for the 4:3 + 4:3 reasoning).
//
// So this is the placeholder's approximation of a real tile, and the pair has
// to be changed together. A skeleton on the wrong ratio is not cosmetic: the
// grid reflows the moment the rows land, which reads as a broken render.
export const PLACE_TILE_SKELETON_CLASS = "aspect-[2/3] w-full rounded-2xl";
