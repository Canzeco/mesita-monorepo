// Shared section card — the canonical card primitive for every long-form
// business surface (Place, Promos, Team, etc.). Replaces local `Section`
// definitions that were drifting between files.
//
// Layout: rounded card with a header row (title + optional description on
// the left, optional `right` element opposite) and the children stacked
// below. The outer `gap-3` on the flex column means children inherit
// vertical rhythm.
//
// Pages compose multiple sections in a `<div className="flex flex-col
// gap-4">` so the inter-section spacing stays consistent.
//
// ── THE LABEL LANE, opt-in (MESITA-1861) ──────────────────────────────────
//
// Pato, on the Configuration page: *"make this more pretty."* The ugliness
// was mechanical. The console is FLUID — no max-width, and MESITA-1836 is
// emphatic that it stays that way — so a card is ~1690px wide. Stacked, that
// means the title sits at the far left edge and its one control sits at the
// far right edge with 1400px of white between them. Not spacious: broken.
//
// `lane` splits the card into a 288px LABEL lane and a content lane. The
// title and description stay put; the body moves up beside them, so the eye
// travels ~300px instead of ~1400px. The card is still full-bleed — this caps
// a COLUMN INSIDE the card, which is the same move FORM_COLUMN_CLASS makes
// and the opposite of the `max-w-xl` MESITA-1836 deleted.
//
// It is a PROP, not the default. Place, Promos and Team are composed as
// stacked cards today and each needs its own look before it opts in; a
// silent layout change to every console card in an issue about Configuration
// is how three screens get broken at once.
//
// Below `lg` the lane collapses and the label becomes a header again. That is
// the layout the narrow viewport actually wants, not a fallback: at 700px a
// 288px lane would leave the content lane narrower than the label.
//
// `right` and `lane` compose — the action stays in the label lane, under the
// description, where it belongs to the thing it is named after.

import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  description,
  right,
  children,
  className,
  lane = false,
}: {
  /** An anchor, when something on the same page links AT this box —
   *  Products' catalogue points its Mesita Pay card at the Mesita Pay box
   *  below the grid (MESITA-1869). Omitted everywhere else: an id nobody
   *  targets is dead weight in the DOM. */
  id?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Two-lane layout: a 288px label lane beside the content, from `lg`. */
  lane?: boolean;
}) {
  const header = (
    <div className={cn("min-w-0", lane ? "flex flex-col gap-3" : "flex-1")}>
      <div>
        <h3 className="font-display text-sm font-semibold tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
            {description}
          </p>
        )}
      </div>
      {/* In lane mode the action sits under its own label rather than across
          the card, so it never becomes a second stranded right edge. */}
      {lane && right && <div>{right}</div>}
    </div>
  );

  return (
    <section
      id={id}
      // A linked-to box must not land under nothing: the shell's `main` is
      // the only scroller, so `scroll-mt` is what keeps the heading clear of
      // the header line above it when the anchor is followed.
      className={cn(
        id && "scroll-mt-6",
        // The live boxes LIFT (MESITA-1861). `--shadow-card` has been in
        // globals.css since the admin port and is used 18 times by the
        // components that came with it; nothing the console composed itself
        // ever used it, which is why every org page reads flat. Offset plus
        // soft blur — not a zero-offset halo — so it is depth, not decoration.
        // SoonStrip deliberately does NOT take it: rank comes from depth here,
        // which is what lets both families share one type size.
        "border-border bg-card shadow-card rounded-2xl border p-4",
        lane
          ? "grid grid-cols-1 gap-3 lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-8"
          : "flex flex-col gap-3",
        className,
      )}
    >
      {lane ? (
        header
      ) : (
        <div className="flex items-start justify-between gap-3">
          {header}
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {/* Only lane mode wraps: the stacked card's children have always been
          direct flex items of the section's own `gap-3` column, and a wrapper
          that tried to disappear with `display:contents` would be racing
          `display:flex` inside Tailwind's own display bucket. */}
      {lane ? (
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      ) : (
        children
      )}
    </section>
  );
}
