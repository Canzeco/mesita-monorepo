"use client";

// THE HEADER. One of them, on every subpage (MESITA-2008).
//
// Pato, 2026-09-19: *"SO DO THE MENU AND A HEADER SAME HEADER FOR ALL SUBPAGES.
// STANDARIZE FUCKING DESIGN."*
//
// ── WHAT IT REPLACES ───────────────────────────────────────────────────────
//
// Eight screens and five treatments. The product pane drew a 44px chip, an
// `h2` at `text-lg`, a state badge and a blurb; the Plan pane drew the SAME
// markup from its own file and had already drifted to two badges; Future
// products drew the heading and nothing else; the portfolio and Add place drew
// an `h1` at `text-2xl`; and Settings, the place's own screen and every
// `/places/<id>/<view>` address drew NO HEADER AT ALL.
//
// The title size flipped with the door you came through — `text-2xl` on the
// portfolio, `text-lg` one click later, nothing on Settings — so on three
// screens the console's only answer to "where am I" was which row the sidebar
// had lit.
//
// ── THE SLOTS, AND WHY AN ABSENT ONE TAKES NO SPACE ────────────────────────
//
//   ┌──────────────────────────────────────────────┐
//   │  ⬛  Online Orders  [On]                      │   mark · title · badges
//   │      Pickup and delivery, paid the moment…    │   blurb
//   │      On here.                                 │   note
//   │  ─Setup─  Activity                            │   tabs, on the hairline
//   └──────────────────────────────────────────────┘
//
// Only `title` is required. Settings has no state badge, the portfolio has no
// mark, Add place has neither — and the alternative on the table was a SECOND
// title-only header for the screens with no subject, which is two components
// to keep in sync and the exact drift this file exists to end.
//
// A missing slot renders NOTHING rather than a reserved empty box. That is what
// makes one component honest on a screen with a subject and on a screen
// without: the header is the same SHAPE everywhere because the shape is
// "whatever of these exists, in this order", not a grid with holes in it.
//
// ── IT IS THE PAGE'S `h1`, AT ONE SIZE ─────────────────────────────────────
//
// `text-xl` — 20px. Bigger than the `text-lg` the panes used, because a page
// title should read as a page; smaller than the `text-2xl` the portfolio used,
// because 24px over a 13px console is the ratio MESITA-2001 pulled the top menu
// back down from, and the menu is a smaller claim than this.
//
// `h1` ON EVERY SCREEN, and `AppShell`'s `sr-only` h1 went with it. A screen
// with a visible title does not need an invisible one, and a page carrying both
// is an outline that says the reader moved a level when they did not. The pane
// used to argue for `h2` on the grounds that it sat *"under Setup's own h1"* —
// Setup was an index page with its own heading then, and it is the menu now,
// so there is no outer heading left to sit under.
//
// ── THE TABS BELONG TO THE SUBJECT ─────────────────────────────────────────
//
// `Setup | Activity` renders INSIDE the header, on its bottom hairline, rather
// than in the pane body below it. The pair is a fact about the thing the header
// names, so a product that has it and a product that does not are the same
// object with one slot filled — not two layouts. Putting it in the body would
// also have drawn a hairline under the header and a second under the tabs, two
// rules about 40px apart.
import { SCOPE_CHIP_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export function PageHeader({
  mark,
  markClass,
  titleClass,
  title,
  badges,
  blurb,
  note,
  tabs,
  right,
}: {
  /** The subject's emoji, or a whole element for a screen whose mark is a
   *  photograph rather than a glyph — the place's own screen passes a
   *  `PlaceChip`. Absent on the portfolio and Add place, which are about no
   *  single thing. */
  mark?: React.ReactNode;
  /** WHAT THE MARK'S PLATE IS PAINTED WITH, and what the title is written in
   *  (MESITA-2037). Both default to the achromatic pair every other screen
   *  uses; a PRODUCT page passes its family's tint and ink, so the header of
   *  Online Orders is the same blue an operator just clicked in the catalogue.
   *
   *  THIS IS A SLOT, NOT A LOOKUP. `PageHeader` must not learn what a product
   *  is — Add place, the portfolio and Settings all render it and none of them
   *  has a `ProductKey` — so the caller that knows brings the classes. */
  markClass?: string;
  titleClass?: string;
  title: string;
  /** Rendered beside the title, wrapping with it. The Plan pane passes two;
   *  everything else passes one or none. */
  badges?: React.ReactNode;
  /** One line on what this screen is. */
  blurb?: React.ReactNode;
  /** A second line that is louder than the blurb, for a fact about THIS place
   *  rather than about the product — "On here.", "Needs Mesita Pro." */
  note?: React.ReactNode;
  /** The `Setup | Activity` pair, on the bottom hairline. */
  tabs?: React.ReactNode;
  /** A control that belongs to the page rather than to a section of it — the
   *  portfolio's Add door. It sits on the title's own line, pushed right, and
   *  drops below the title on a phone rather than squeezing it. */
  right?: React.ReactNode;
}) {
  return (
    <header className={cn("flex flex-col gap-3", tabs && "border-border border-b")}>
      <div className="flex items-start gap-3">
        {/* THE MARK IS `aria-hidden` AND SO IS ITS BOX. An emoji read aloud
            before every page title is a screen reader saying "shopping bags"
            where a sighted reader sees a 22px picture they have already
            stopped noticing. The title carries the name. */}
        {mark !== undefined && mark !== null && (
          <span
            aria-hidden
            className={cn(
              SCOPE_CHIP_CLASS,
              "text-foreground flex shrink-0 items-center justify-center overflow-hidden",
              markClass ?? "bg-muted",
            )}
          >
            {typeof mark === "string" ? (
              <span className="text-[22px] leading-none">{mark}</span>
            ) : (
              mark
            )}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1
              className={cn(
                "font-display text-xl font-semibold tracking-tight",
                titleClass,
              )}
            >
              {title}
            </h1>
            {badges}
          </div>
          {blurb && (
            <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
              {blurb}
            </p>
          )}
          {note && (
            <p className="text-foreground mt-1 text-[13px] leading-snug font-medium">
              {note}
            </p>
          )}
        </div>

        {right && <div className="shrink-0">{right}</div>}
      </div>

      {tabs}
    </header>
  );
}

/** The tab pair's shared shape, so the one caller that draws tabs and any
 *  future one cannot disagree about them.
 *
 *  A RULE, NOT A FILL — the opposite of the call `Sidebar` makes one column to
 *  the left, and for the reason MESITA-1975 gave: across a LINE a solid pill is
 *  a slab with a word in it. Two tabs are a line; the menu is a stack. The two
 *  idioms mark different axes, and reading them the same way is what makes a
 *  console look like two consoles.
 *
 *  The rule insets to the LABEL rather than to the tab's box. `inset-x-0`
 *  overshoots the word at both ends and reads as a text-decoration somebody
 *  left on; MESITA-2001 fixed exactly this on the top menu. The inset tracks
 *  `px-3` and has to move with it. */
export const HEADER_TAB =
  "relative flex min-h-9 items-center px-3 text-[13px] transition outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";
export const HEADER_TAB_REST =
  "text-muted-foreground hover:text-foreground font-medium";
export const HEADER_TAB_ACTIVE =
  "text-foreground font-semibold after:bg-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:content-['']";

export function HeaderTabs({ children }: { children: React.ReactNode }) {
  return <div className="-mb-px flex gap-1">{children}</div>;
}
