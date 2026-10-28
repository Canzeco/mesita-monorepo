// Shared Tailwind class strings for form primitives + feedback boxes.
//
// These are intentionally NOT React components — they're string constants
// so you can compose them with cn() at the call site, mix in modifiers,
// or apply them to native elements without an extra wrapper.

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
  "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-paper transition disabled:opacity-60";

// Sheet / section heading — the display-font h2 used at the top of modals and
// page sections. Compose with cn() when a row needs extra layout classes.
export const SHEET_TITLE_CLASS =
  "font-display text-xl font-semibold tracking-tight";

// Scrollable body region under a LocalSheet / BottomSheet header — the padded
// content column every modal shares. Compose with cn() for per-sheet tweaks.
export const SHEET_BODY_CLASS =
  "scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5";

// Mesita Instagram icon tint (oklch warm→magenta) — IconCircle + the
// Instagram identity UI.
export const INSTAGRAM_ICON_GRADIENT_CLASS =
  "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]";

// Secondary Cancel action used in LocalSheet footers (bordered, card fill).
export const SHEET_CANCEL_BUTTON_CLASS =
  "border-border bg-card hover:bg-muted flex-1 rounded-lg border py-3 text-sm font-semibold transition";

// Sheet grabber — the 40×4 pill that says "this pulls from the bottom".
export const SHEET_GRABBER_CLASS =
  "bg-foreground/20 mx-auto mt-2 h-1 w-10 shrink-0 rounded-full";
