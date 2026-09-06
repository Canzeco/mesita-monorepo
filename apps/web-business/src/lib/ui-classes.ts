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

// Small pill action button — the canonical header CTA ("Invite business",
// "Add staff", etc.). Dark fill, 12px text, pill-shaped. For a
// full-width form submit use PRIMARY_BUTTON_CLASS instead.
export const PILL_BUTTON_CLASS =
  "bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-60";

// Compact icon button (32px circle) — for trash / send / copy actions on
// list rows. Border ring + subtle hover so it doesn't compete with the
// row content. Pair with `aria-label` and `title` for accessibility.
export const ICON_BUTTON_CLASS =
  "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50";

// Solid dark pill CTA — the empty-state / error-state primary action
// ("Add a place", "Try again"). Roomier padding than PILL_BUTTON_CLASS and
// not full-width like PRIMARY_BUTTON_CLASS. Compose with cn() for margins.
export const CTA_BUTTON_CLASS =
  "bg-foreground text-background inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90";

// Section / empty-state title — display face, xl, tight tracking.
export const SECTION_TITLE_CLASS =
  "font-display text-xl font-semibold tracking-tight";

// Quiet pill action — the secondary partner to PILL_BUTTON_CLASS ("Edit",
// "Cancel", "Manage"). Border ring, no fill, so it reads as available
// without competing with the dark CTA beside it. A 12px grey text link is
// not enough affordance for a real action; this is.
export const GHOST_PILL_BUTTON_CLASS =
  "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition disabled:opacity-60";

// ── The shell's one width law (MESITA-1558) ────────────────────────────────
//
// The console is FLUID: no max-width. Pato asked it to use all the space, and
// the repo's own rule for keeping that readable is one line down — cap the
// form, not the card. Wide is fine for a card, a data row or a list; it is a
// form field that must not become a 2000px box for a 13-character RFC.
//
// SHELL_GUTTER and SHELL_BLEED are a PAIR and must stay in lockstep: the bleed
// is exactly the negative of the gutter at every breakpoint, so a full-bleed
// child of <main> lands flush against the window. Change one, change the other
// — `shell-chrome.test.ts` fails if they ever disagree.
export const SHELL_GUTTER = "px-4 sm:px-6 lg:px-8";
export const SHELL_BLEED = "-mx-4 sm:-mx-6 lg:-mx-8";

/** Row 1's occupied height: the h-14 bar (56px) PLUS its 1px bottom border.
 *  Row 2 parks at exactly this offset. Larger and a strip of body content
 *  scrolls through the gap between them; smaller and they overlap, which is
 *  invisible because row 1 paints above. */
export const TOPNAV_OCCUPIED_PX = 57;

/** Row 2's sticky offset. The literal 57 has to be written out — Tailwind
 *  scans source text and cannot read a constant — so `shell-chrome.test.ts`
 *  asserts this string and TOPNAV_OCCUPIED_PX agree, and that the mobile
 *  offset is 0 because row 1 is `static` there. */
export const PLACEBAR_STICKY_CLASS = "sticky top-0 sm:top-[57px]";

// Readable measure for a single-column form. Inputs inherit the width of
// their container, and a 900px-wide box for a 13-character RFC reads as a
// mistake — cap the form, not the card.
export const FORM_COLUMN_CLASS = "flex w-full max-w-md flex-col gap-3";
