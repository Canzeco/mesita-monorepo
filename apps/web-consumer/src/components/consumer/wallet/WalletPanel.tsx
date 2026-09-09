import { cn } from "@/lib/utils";

// The Wallet's one section object (Pato, 2026-09-08: "Put in boxes,
// modularize", drawn over a screenshot of the shipped screen).
//
// MODULAR MEANS A FOURTH SECTION IS A MOUNT, not a paste. Everything specific
// to a section — its title, its buttons, its body — arrives as a prop. There is
// no Wallet-only styling left inside CreditsClient.
//
// ── The repair (MESITA-1708, Pato: "better desiggn. wtf is that") ───────────
//
// The first version drew a `border-b` under every panel header and set the
// title as a bare `<h2>`. Both were wrong, and together they turned the Wallet
// into a settings form:
//
// NO DIVIDER UNDER THE HEADER. It was the strongest line on the screen and it
// separated a title from its own content — the one relationship a panel exists
// to assert. A panel is one surface; whitespace is what groups it. Three
// stacked panels also meant six horizontal rules, which is the "App UI made of
// stacked cards instead of layout" pattern the package rule already names in
// its own words: "wireframe stacks = regression".
//
// THE TITLE IS NOT IN THE DISPLAY FACE. globals.css puts `h1, h2, h3` in
// Fraunces, and `assets/brand/brand.json` is explicit about what that face is
// for: "h1-h3, the wordmark, numerals in hero positions". A 14px serif repeated
// three times as a section legend is none of those — it is the same typeface
// that makes MX$2,500 read like money, spent on the word "Cards". So the
// element stays an `<h2>` (a screen reader needs the heading) and the FAMILY is
// overridden back to the body face at label scale: the panel names itself
// quietly and the content inside it leads.
//
// ONE PADDING, `px-4`, on the header and the body alike, so the title's left
// edge and the content's left edge are the same line.

export function WalletPanel({
  title,
  /** The section's own buttons — Add on Cards, Gift · Redeem on Credits. */
  actions,
  children,
  className,
  /** Sub-headings inside the body need the section's name to point at. */
  labelledBy,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-label={labelledBy ? undefined : title}
      aria-labelledby={labelledBy}
      className={cn(
        "border-border bg-card overflow-hidden rounded-2xl border",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-1">
        {/* `font-sans` is load-bearing: it undoes globals.css's h1-h3 rule. See
            the header — the display face belongs to the balance, not to this. */}
        <h2
          id={labelledBy}
          className="text-muted-foreground type-label shrink-0 font-sans font-bold tracking-[0.12em] uppercase"
        >
          {title}
        </h2>
        {actions ? (
          <div className="flex min-w-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="px-4 pt-2 pb-4">{children}</div>
    </section>
  );
}

/** A zero state sized for a PANEL, which is not the same object as a zero state
 *  sized for a screen.
 *
 *  `EmptyState` (components/shared) is the screen one, and its own header says
 *  so: it is `flex-1` + `justify-center` + `pb-10` because "a box floating at
 *  the top of 700px of nothing reads as a screen that failed to load". Mounted
 *  inside a 200px panel it does the opposite — a tinted icon tile, a display
 *  headline and a centred paragraph, all inside a bordered box, which is a
 *  container wrapping a container wrapping nothing. That nesting is what
 *  MESITA-1708 was filed to remove, so this exists rather than another prop on
 *  the shared one: the two states have different shapes, not different sizes.
 *
 *  No icon, no border, no centring. A line that says what the thing is worth,
 *  and the one action that starts it. */
export function WalletPanelEmpty({
  headline,
  description,
  action,
}: {
  headline: string;
  description: string;
  /** Omit on a panel whose action already sits in the header (Cards' Add). */
  action?: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="text-foreground text-sm leading-snug font-semibold">
        {headline}
      </p>
      <p className="text-muted-foreground type-label mt-1 max-w-[34ch] leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-3.5">{action}</div> : null}
    </div>
  );
}
