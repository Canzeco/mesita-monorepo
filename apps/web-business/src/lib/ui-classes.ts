// Shared Tailwind class strings for form primitives + feedback boxes.
//
// These are intentionally NOT React components — they're string constants
// so you can compose them with cn() at the call site, mix in modifiers,
// or apply them to native elements without an extra wrapper. The fields
// that DO benefit from a component (label + hint + required mark, for
// example) live in src/components/shared/Field.tsx.

// ── The two laws every control below obeys (MESITA-1862) ──────────────────
//
// FOCUS: a keyboard user gets the BRAND's ring, never the user agent's. The
// console already spoke this vocabulary in four places — Sidebar.tsx,
// RailSelector.tsx, PlaceGallery.tsx, ProductCatalog.tsx all ship
// `focus-visible:ring-2` — and the shared constants were the hole. Anything
// here that kills the UA outline MUST put a ring back in the same string;
// `control-affordances.test.ts` fails the pairing, because killing the
// outline alone is worse than no rule at all (INPUT_CLASS carried exactly
// that, and a tinted border is not a focus indicator).
//
// `outline-hidden`, NOT `outline-none` — and in Tailwind v4 those are two
// different utilities, not two names for one. `outline-none` compiles to a
// bare `outline-style: none`. `outline-hidden` compiles to the same thing
// PLUS `@media (forced-colors: active) { outline: 2px solid transparent;
// outline-offset: 2px }`. That transparent outline is the escape hatch:
// Windows high-contrast mode does not paint box-shadows, which is what every
// `ring-*` utility is, so under forced colors the shadow ring vanishes — and
// with the bare spelling the control is left with NO focus indicator at all,
// strictly worse than the UA outline this string set out to replace. The
// forced-colors repaint turns that transparent outline into a real system
// ring. Identical in normal mode; do not "simplify" it back.
//
// The offset is load-bearing, not decoration: a 2px pink ring drawn straight
// onto a `bg-foreground` near-black pill reads as a border artifact. Two
// pixels of page background between fill and ring is what makes it a ring.
// `--ring` is the brand pink in both themes (globals.css:74 and :172). The
// RAIL does not use it: it is dark ground and has `--sidebar-ring` of its own
// (MESITA-1831), asserted by shell-chrome.test.ts. Do not unify them.
export const FOCUS_RING_CLASS =
  "outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// TOUCH: 44px minimum — as a HIT AREA around the paint, not as a bigger pill.
//
// Growing every control to 44px was the other option and it makes the member
// row worse: MESITA-1861's finding on those rows is that they already carry
// too many competing shapes, and a 44px circle beside a 32px pill is one
// more. So the paint stays exactly where the design review left it and an
// invisible `after:` rectangle, centred on the control, carries the finger.
//
// Vertical only (`inset-x-0`): these pills are wide enough already, and
// growing them sideways would make two adjacent hit areas overlap, which
// turns "44px target" into "wrong button". The icon button is the exception
// below — it is a 32px circle and needs all four sides.
export const TOUCH_TARGET_CLASS =
  "relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:w-full after:-translate-y-1/2 after:content-['']";

// The square variant, for the 32px icon circle: 44 × 44 centred on the paint,
// so it grows 6px on every side. MembersCard's rows carry `gap-3` for exactly
// this reason — at `gap-2` the × hit area came within 2px of the pill beside
// it and overlapped the role chip on the invite row.
export const ICON_TOUCH_TARGET_CLASS =
  "relative after:absolute after:top-1/2 after:left-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

// Single-line text input. Matches the visual rhythm used across every
// Mesita form: 44px tall, 12px border-radius, subtle card background.
// Two focus affordances, deliberately: the border tint is the resting one a
// mouse user sees, the ring is the keyboard one. The bare `outline-none` that
// used to sit in this string is gone — FOCUS_RING_CLASS supplies the outline
// reset in its forced-colors-safe spelling, and only together with the ring
// that replaces what it removes.
export const INPUT_CLASS = `h-11 w-full rounded-xl border border-border bg-card px-3 text-sm transition focus:border-foreground/40 ${FOCUS_RING_CLASS}`;

// Destructive feedback (form errors, failed actions). Lower contrast than
// the destructive color full-strength so it reads as a notice, not an alert.
export const ERROR_BOX_CLASS =
  "rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive";

// Neutral feedback (success info, hints, "check your inbox" messages).
export const INFO_BOX_CLASS =
  "rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground";

// Primary submit button. Used for the bottom-of-form action — full-width,
// pill-shaped, dark-foreground fill. Use cn() to merge in `flex-1`, etc.
// Already 48px tall, so it needs no hit area — only the ring.
export const PRIMARY_BUTTON_CLASS = `flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background transition disabled:opacity-60 ${FOCUS_RING_CLASS}`;

// Tiny uppercase eyebrow label — used for section eyebrows ("PENDING
// INVITES"), "Read-only" badges, stat tile captions, etc. Single source
// so size + tracking stay aligned across the business console.
export const TINY_LABEL_CLASS =
  "text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.14em]";

// Small pill action button — the canonical header CTA ("Invite business",
// "Add staff", etc.). Dark fill, 12px text, pill-shaped. For a
// full-width form submit use PRIMARY_BUTTON_CLASS instead.
// ~30px of paint (py-1.5 on 12px text), so it carries the 44px hit area.
export const PILL_BUTTON_CLASS = `bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-60 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;

// Compact icon button (32px circle) — for trash / send / copy actions on
// list rows. Border ring + subtle hover so it doesn't compete with the
// row content. Pair with `aria-label` and `title` for accessibility.
// 32px of paint — the × that removes a teammate, which is the single control
// in this console where a mis-tap costs the most. Square hit area.
export const ICON_BUTTON_CLASS = `border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50 ${FOCUS_RING_CLASS} ${ICON_TOUCH_TARGET_CLASS}`;

// Solid dark pill CTA — the empty-state / error-state primary action
// ("Add a place", "Try again"). Roomier padding than PILL_BUTTON_CLASS and
// not full-width like PRIMARY_BUTTON_CLASS. Compose with cn() for margins.
// ~41px of paint — under 44 by three pixels, which the issue did not name and
// which is exactly the kind of near-miss that gets the same finding filed
// again next pass. It takes the hit area too.
export const CTA_BUTTON_CLASS = `bg-foreground text-background inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;

// Section / empty-state title — display face, xl, tight tracking.
export const SECTION_TITLE_CLASS =
  "font-display text-xl font-semibold tracking-tight";

// Quiet pill action — the secondary partner to PILL_BUTTON_CLASS ("Edit",
// "Cancel", "Manage"). Border ring, no fill, so it reads as available
// without competing with the dark CTA beside it. A 12px grey text link is
// not enough affordance for a real action; this is.
export const GHOST_PILL_BUTTON_CLASS = `border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition disabled:opacity-60 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;

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

// PLACEBAR_STICKY_CLASS is GONE (MESITA-1714), and the story is worth keeping
// because the same mistake is easy to make again.
//
// It started as `sticky top-0 sm:top-[57px]`, paired with a
// TOPNAV_OCCUPIED_PX constant encoding the exact height of the top bar above
// it. MESITA-1710 turned the nav into a lateral rail and the obvious move was
// to re-derive 57 into a new number for the new header. That was wrong twice
// over: the frame is `fixed inset-0` with `main` as the only scroller and the
// header as main's SIBLING, so there was nothing above it in its own
// scrollport at all — and then MESITA-1714 deleted the bar outright, because
// once the rail carries the place's name AND its views, a sticky row
// restating both is 48px of chrome saying what the column beside it says.
//
// Neither constant needed a new value. Both stopped having a job.
//
// SHELL_BLEED above SURVIVES all of this: PlaceStatesTable is its other
// consumer, so the gutter/bleed pairing is still load-bearing and still
// asserted.

// Readable measure for a single-column form. Inputs inherit the width of
// their container, and a 900px-wide box for a 13-character RFC reads as a
// mistake — cap the form, not the card.
export const FORM_COLUMN_CLASS = "flex w-full max-w-md flex-col gap-3";

// THERE IS NO ACCOUNT COLUMN CONSTANT, and the hole is the point (MESITA-1836).
// One briefly lived here: MESITA-1834 was asked for "one column, not two", and
// the stack shipped with an invented `max-w-xl` cap beside it — the reasoning
// being that a stacked row in a fluid console runs to 1700px. MESITA-1835 then
// tuned that invented number. Pato: "i mean, one full width column, wtf is
// that." The column above is for FORMS, which Account holds none of; every
// other console page is a fragment in the layout's own full-width column, and
// Account is too. Do not add this constant back.

// ── Account's ONE box (MESITA-1840) ───────────────────────────────────────
//
// Pato, on the three boxes live: "merge."
//
// MESITA-1837 made them three separate cards at one rank ("three big boxes"),
// which fixed the real bug — MESITA-1833 had ranked the person as a header
// above two rows, giving three different weights to three things that are
// each one thing. The parity was right. The containers were not: on the
// account this console is optimized for (one organization, one place), three
// bordered cards with gaps between them are three boxes carrying one fact
// each, and the borders say the person, the organization and the place are
// unrelated. They are one scope, read top to bottom.
//
// So: ONE card, three rows, hairlines instead of gaps. The rank MESITA-1837
// established is untouched — every row has the same chip well, the same
// eyebrow, the same title weight, the same height. The merge removes the
// chrome between them, never the parity.
//
// Shared by the page (the You row, a plain div) and ScopeSwitchers (the two
// menu triggers) so the three cannot drift apart — the drift is the whole
// failure mode here, and a shared string is cheaper than a component that
// would have to be a client one for the two that open menus.
//
// `divide-y` needs the three rows to be DIRECT children, which is why
// ScopeSwitchers returns a fragment rather than its own wrapper.
//
// FULL WIDTH: the console is fluid and Account caps nothing (MESITA-1836).
export const SCOPE_CARD_CLASS =
  "border-border bg-card divide-border w-full min-w-0 divide-y overflow-hidden rounded-2xl border";

export const SCOPE_ROW_CLASS =
  "flex min-h-24 w-full min-w-0 items-center gap-4 px-5 py-4 text-left";

// The row's 44px chip well — the monogram, the place thumb, the plus.
export const SCOPE_CHIP_CLASS = "h-11 w-11 shrink-0 rounded-xl";

// ── The wide-record table (MESITA-1608) ────────────────────────────────────
//
// The identity column of a states matrix, pinned to the left edge while the
// state columns scroll past it. Twenty-one columns have no anchor otherwise.
//
// NO `sm:` RESET, and that is the whole difference from web-admin's twins.
// Admin's constants end in `sm:static sm:bg-transparent` because its catalog
// is `min-w-[1040px]` and genuinely fits its column from `sm` — its own
// comment says "Static again from sm, where the table fits its column." This
// table is ~1540px. Copying admin verbatim would pin the identity column on
// phones and UNPIN it on every laptop, which is precisely backwards: the
// laptop is where an operator actually reads this, and it is where the
// horizontal travel is longest.
//
// The opaque backgrounds are load-bearing at every width for the same reason
// they are on a phone: a sticky cell slides OVER its neighbours, so a
// translucent tint lets them read through it. Body cells sit on the card, so
// `bg-card` is exact; the header's `bg-muted/30` has to be flattened against
// the card to get an opaque twin of the same colour.
export const STATES_COL_HEAD =
  "sticky left-0 z-20 bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))]";

export const STATES_COL_CELL = "sticky left-0 z-10 bg-card";

// The action column, pinned to the RIGHT — but only from `sm`.
//
// On a 390pt phone the content width is 358px (SHELL_GUTTER is px-4 and the
// table bleeds past it). A pinned identity cell plus a pinned action cell
// holding Open and Claim is roughly 234 + 140 = 374px, which leaves NEGATIVE
// room for the states between them. Below `sm` the actions scroll with the
// table and the identity column keeps the anchor to itself.
export const STATES_ACTION_HEAD =
  "sm:sticky sm:right-0 sm:z-20 sm:bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))]";

export const STATES_ACTION_CELL = "sm:sticky sm:right-0 sm:z-10 sm:bg-card";

// The header row, pinned to the top of ITS OWN SCROLLPORT.
//
// NO `top-[…]` OFFSET HERE, EVER (MESITA-1658). This used to read
// `sticky top-0 z-30 sm:top-[57px]`, copied from PLACEBAR_STICKY_CLASS above
// — and the same characters mean something else in this position.
//
// `position: sticky` resolves `top` against the nearest SCROLLING ANCESTOR.
// PlaceBar has none between it and the page, so its 57px genuinely clears the
// console nav. This header sits inside PlaceStatesTable's `overflow-x-auto`
// div, and CSS forces `overflow-y` to `auto` when the other axis is not
// `visible` — so that div IS a scroll container, and 57px was measured from
// the top of a box INSIDE the card. The page's nav does not exist in that
// coordinate system.
//
// The symptom, live for weeks: at scroll position 0 the thead shifted down
// 57px while its flow space stayed put, so the first row's thumbnail surfaced
// in the gap ABOVE the column labels and the card's `overflow-hidden` clipped
// the rest. It read as a broken, half-empty table — twice, before anyone
// found the cause.
//
// The old comment's ambition — pinned under the console nav so a hundred rows
// never lose their labels — is NOT reachable through a nested scrollport at
// all. Sticking to the page viewport would mean the table is not a scroll
// container, and the wide table needs its horizontal scroll. The labels pin
// to the card instead. Recorded as the tradeoff, not left as an aspiration
// the code cannot meet.
export const STATES_HEAD_STICKY = "sticky top-0 z-30";

// The header ROWS' own background — same load-bearing opacity rule as
// STATES_COL_HEAD above, just missed the first time (MESITA-1631): the whole
// `<thead>` is sticky, so both its `<tr>`s float over the scrolling `<tbody>`
// exactly like the pinned identity column floats over the scrolling states.
// `bg-muted/30` on the header rows let the first data row's chips show
// straight through — garbled, overlapping text once anything sat under the
// header. Same flattened `color-mix` as the pinned column/action cells, so
// the two opaque backgrounds actually match instead of drifting apart.
export const STATES_HEAD_BG =
  "bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))]";
