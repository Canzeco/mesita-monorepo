import { cn } from "@/lib/utils";

// The Wallet's one section object (Pato, 2026-09-08: "Put in boxes,
// modularize", drawn over a screenshot of the shipped screen).
//
// WHAT WAS WRONG. Ways to pay was a bordered card; Cards and Credits were bare
// `<section>`s — a heading, an action, and content sitting straight on the page
// background. Three blocks, two chrome systems, and the two that mattered most
// had none. The wireframe draws all three as the same object, so they become
// the same component rather than three copies of the same header markup.
//
// THE HEADER LIVES INSIDE THE BOX, not above it. That is the whole difference
// between a panel and a heading with stuff under it: the title, the actions and
// the content are one surface, so a guest reads "these buttons belong to this
// list" without being told. It is also why the divider is drawn only when a
// header and a body both exist.
//
// MODULAR MEANS A FOURTH SECTION IS A MOUNT, not a paste. Everything specific
// to a section — its title, its buttons, its body — arrives as a prop. There is
// no Wallet-only styling left inside CreditsClient.
//
// ONE PADDING, `px-4`, on the header and the body alike, so the title's left
// edge and the content's left edge are the same line. `overflow-hidden` is what
// lets the rounded corner clip a body that paints to its own edge.

export function WalletPanel({
  title,
  /** The section's own buttons — Add on Cards, Buy · Gift · Redeem on Credits. */
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
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id={labelledBy} className="shrink-0 text-sm font-bold">
          {title}
        </h2>
        {actions ? (
          <div className="flex min-w-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
