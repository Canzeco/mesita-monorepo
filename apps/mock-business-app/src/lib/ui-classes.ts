// Shared Tailwind class strings. Not components, so they compose with cn() at
// the call site. Snapshot of the constants this mock actually renders.
//
// TWO LAWS every control below obeys:
//
// FOCUS — a keyboard user gets the BRAND's ring, never the user agent's.
// `outline-hidden`, NOT `outline-none`: in Tailwind v4 those are different
// utilities. The bare one compiles to `outline-style: none` and nothing else,
// so under Windows high-contrast — where box-shadows (and therefore every
// `ring-*`) are not painted — the control is left with NO focus indicator at
// all, strictly worse than the outline it removed. `outline-hidden` adds the
// forced-colors repaint that turns a transparent outline into a real system
// ring. Anything here that kills the outline MUST put a ring back in the same
// string.
export const FOCUS_RING_CLASS =
  "outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// TOUCH — 44px minimum, as a HIT AREA around the paint rather than a bigger
// pill. Vertical only: these pills are wide already, and growing them sideways
// makes two adjacent hit areas overlap, which turns "44px target" into "wrong
// button".
export const TOUCH_TARGET_CLASS =
  "relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:w-full after:-translate-y-1/2 after:content-['']";

export const ICON_TOUCH_TARGET_CLASS =
  "relative after:absolute after:top-1/2 after:left-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

export const INPUT_CLASS = `h-11 w-full rounded-xl border border-border bg-card px-3 text-sm transition focus:border-foreground/40 ${FOCUS_RING_CLASS}`;

export const ERROR_BOX_CLASS =
  "rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive";

export const INFO_BOX_CLASS =
  "rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground";

export const TINY_LABEL_CLASS =
  "text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.14em]";

export const PILL_BUTTON_CLASS = `bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-60 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;

export const GHOST_PILL_BUTTON_CLASS = `border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition disabled:opacity-60 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;

export const ICON_BUTTON_CLASS = `border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50 ${FOCUS_RING_CLASS} ${ICON_TOUCH_TARGET_CLASS}`;

export const CTA_BUTTON_CLASS = `bg-foreground text-background inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;

export const SECTION_TITLE_CLASS =
  "font-display text-xl font-semibold tracking-tight";

// ── The shell's one width law ──────────────────────────────────────────────
//
// The console is FLUID: no max-width. The gutter and the bleed are a PAIR and
// must stay in lockstep — the bleed is exactly the negative of the gutter at
// every breakpoint, so a full-bleed child of <main> lands flush against the
// window. Change one, change the other.
export const SHELL_GUTTER = "px-4 sm:px-6 lg:px-8";
export const SHELL_BLEED = "-mx-4 sm:-mx-6 lg:-mx-8";

// Readable measure for a single-column FORM. Cap the form, not the card: a
// 1700px box for a 13-character field reads as a mistake, and capping the card
// instead is the `max-w-xl` that got deleted twice ("i mean, one full width
// column, wtf is that"). There is deliberately no page-width constant here.
export const FORM_COLUMN_CLASS = "flex w-full max-w-md flex-col gap-3";

// Account's ONE card of rows: hairlines instead of gaps, because three
// bordered cards with space between them say the rows are unrelated.
// `divide-y` needs the rows to be DIRECT children.
export const SCOPE_CARD_CLASS =
  "border-border bg-card divide-border w-full min-w-0 divide-y overflow-hidden rounded-2xl border";

export const SCOPE_ROW_CLASS =
  "flex min-h-24 w-full min-w-0 items-center gap-4 px-5 py-4 text-left";

export const SCOPE_CHIP_CLASS = "h-11 w-11 shrink-0 rounded-xl";

// The wide-record table: the identity column pinned left while the state
// columns scroll past it. The opaque background is load-bearing — a sticky cell
// slides OVER its neighbours, so a translucent tint lets them read through.
export const STATES_COL_HEAD =
  "sticky left-0 z-20 bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))]";
export const STATES_COL_CELL = "sticky left-0 z-10 bg-card";
export const STATES_HEAD_STICKY = "sticky top-0 z-30";
export const STATES_HEAD_BG =
  "bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))]";
