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

// Multi-line input — same skin, taller, with vertical padding.
export const TEXTAREA_CLASS =
  "min-h-[100px] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-foreground/40";

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
  "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background transition disabled:opacity-60";

// Tiny uppercase eyebrow label — used for section eyebrows ("PENDING
// INVITES"), "Read-only" badges, stat tile captions, etc. Single source
// so size + tracking stay aligned across the business console.
export const TINY_LABEL_CLASS =
  "text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.14em]";

// Numeric display used for stat figures (audience counts, balance, etc.).
// Pairs naturally with a smaller cadence/suffix sibling.
export const NUMBER_CLASS = "font-display tabular-nums leading-none font-bold";

// Small pill action button — the canonical header CTA ("Invite business",
// "Add waiter", etc.). Dark fill, 12px text, pill-shaped. For a
// full-width form submit use PRIMARY_BUTTON_CLASS instead.
export const PILL_BUTTON_CLASS =
  "bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-60";

// Compact icon button (32px circle) — for trash / send / copy actions on
// list rows. Border ring + subtle hover so it doesn't compete with the
// row content. Pair with `aria-label` and `title` for accessibility.
export const ICON_BUTTON_CLASS =
  "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50";
