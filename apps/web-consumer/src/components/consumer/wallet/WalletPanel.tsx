import { cn } from "@/lib/utils";

// The Wallet's one section object (Pato, 2026-09-08: "Put in boxes,
// modularize", drawn over a screenshot of the shipped screen).
//
// MODULAR MEANS A FOURTH SECTION IS A MOUNT, not a paste. Everything specific
// to a section — its title, its buttons, its body, and now its RANK — arrives
// as a prop. There is no Wallet-only styling left inside CreditsClient.
//
// ── MODULAR IS NOT IDENTICAL (MESITA-1825, Pato: "make the design far
//    cleaner, more modular, wtdf is that") ────────────────────────────────
//
// This component shipped with exactly one look, so every section it mounted
// wore it: three bordered boxes, three 11px uppercase legends, three equal
// weights. That is not a hierarchy, it is the absence of one — and it is the
// pattern the package rule already names, "App UI made of stacked cards
// instead of layout". The second "wtf is that" was the first one's fix.
//
// So rank moved into the component rather than out of it. `chrome` is the
// ladder, and the three sections take three rungs:
//
//   none   Ways to pay   read once, never again — it gets a label and no box
//   flat   Cards         a real section, quietly
//   raised Credits       the money; the only lifted surface on the screen
//
// The SECTION ELEMENT IS THE CONSTANT. Every rung renders the same `<section>`
// with the same heading, so dropping a block's box never drops its landmark or
// its accessible name — which is what un-boxing "by hand" in the caller would
// have cost. That is also why CreditsClient still contains no `<section>` of
// its own: chrome is this file's job at every rung, including the rung with
// no chrome at all.
//
// ── The earlier repair (MESITA-1708, Pato: "better desiggn. wtf is that") ──
//
// NO DIVIDER UNDER THE HEADER. It was the strongest line on the screen and it
// separated a title from its own content — the one relationship a panel exists
// to assert. A panel is one surface; whitespace is what groups it.
//
// THE TITLE IS NOT IN THE DISPLAY FACE. globals.css puts `h1, h2, h3` in
// Fraunces, and `assets/brand/brand.json` is explicit about what that face is
// for: "h1-h3, the wordmark, numerals in hero positions". A 14px serif
// repeated three times as a section legend is none of those — it is the same
// typeface that makes MX$2,500 read like money, spent on the word "Cards". So
// the element stays an `<h2>` (a screen reader needs the heading) and the
// FAMILY is overridden back to the body face at label scale. The face belongs
// to `WalletMoney` below, which is the one thing on this screen that IS a
// numeral in a hero position.
//
// ONE PADDING on the header and the body alike, so the title's left edge and
// the content's left edge are the same line. At `chrome="none"` that padding
// is zero and the page gutter does the job instead.

/** The weight ladder. One prop, three rungs, in rank order. */
export type WalletChrome = "none" | "flat" | "raised";

const CHROME_CLASS: Record<WalletChrome, string> = {
  none: "",
  flat: "border-border bg-card overflow-hidden rounded-2xl border",
  raised:
    "border-border bg-card shadow-rest overflow-hidden rounded-2xl border",
};

/** Header and body share one inset, and an unboxed section has none — its
 *  content lines up with the page gutter instead of indenting inside a box
 *  that is not there. */
const HEAD_CLASS: Record<WalletChrome, string> = {
  none: "pb-2",
  flat: "px-4 pt-3.5 pb-1",
  raised: "px-4 pt-3.5 pb-1",
};

const BODY_CLASS: Record<WalletChrome, string> = {
  none: "",
  flat: "px-4 pt-2 pb-4",
  raised: "px-4 pt-2 pb-4",
};

export function WalletPanel({
  title,
  /** The section's own buttons — Add on Cards, Gift · Redeem on Credits. */
  actions,
  children,
  className,
  /** Sub-headings inside the body need the section's name to point at. */
  labelledBy,
  /** Rank. Defaults to `flat`; only Credits is `raised` and only Ways to pay
   *  is `none`. Two raised sections would be no ladder at all. */
  chrome = "flat",
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
  chrome?: WalletChrome;
}) {
  return (
    <section
      aria-label={labelledBy ? undefined : title}
      aria-labelledby={labelledBy}
      className={cn(CHROME_CLASS[chrome], className)}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          HEAD_CLASS[chrome],
        )}
      >
        {/* `font-sans` is load-bearing: it undoes globals.css's h1-h3 rule. See
            the header — the display face belongs to the money, not to this. */}
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
      <div className={BODY_CLASS[chrome]}>{children}</div>
    </section>
  );
}

/** The figure, in the display face.
 *
 *  A WALLET THAT NEVER NAMES MONEY (MESITA-1825). The screen carried no amount
 *  at all — not even a zero — on the one surface whose whole subject is an
 *  amount. `brand.json` reserves the display face for "numerals in hero
 *  positions" and this is the only hero numeral the Wallet has.
 *
 *  Same treatment as `BalanceCard`'s open face (font-display, bold, tight,
 *  `tabular-nums`) at panel scale rather than card scale, minus the text-shadow
 *  that exists there only because that face sits on a photo.
 *
 *  ONLY THE EMPTY STATE MOUNTS THIS (D3). With balances, the cards carry their
 *  own numerals and there is no honest figure to put here: the EF returns no
 *  grand total and pages by keyset, so a client-side sum is wrong the moment
 *  `hasMore` is true — and Credits are org-scoped, so a cross-org total is
 *  money that cannot be spent as one number anywhere. */
export function WalletMoney({
  amount,
  caption,
}: {
  amount: string;
  caption: string;
}) {
  return (
    <div>
      <p className="font-display text-4xl leading-none font-bold tracking-tight tabular-nums">
        {amount}
      </p>
      <p className="text-muted-foreground type-label mt-2">{caption}</p>
    </div>
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
 *  THE HEADLINE IS OPTIONAL NOW (MESITA-1825). Credits leads with `WalletMoney`
 *  above this block instead — a bold sentence under a MX$0 is two headlines
 *  arguing, and the figure wins that argument on any screen about money.
 *
 *  No icon, no border, no centring. */
export function WalletPanelEmpty({
  headline,
  description,
  action,
}: {
  headline?: string;
  description: string;
  /** Omit on a panel whose action already sits in the header (Cards' Add). */
  action?: React.ReactNode;
}) {
  return (
    <div className="py-1">
      {headline ? (
        <p className="text-foreground text-sm leading-snug font-semibold">
          {headline}
        </p>
      ) : null}
      <p
        className={cn(
          "text-muted-foreground type-body max-w-[34ch] leading-relaxed",
          headline && "mt-1",
        )}
      >
        {description}
      </p>
      {action ? <div className="mt-3.5">{action}</div> : null}
    </div>
  );
}
