/** The Wallet header's pill (MESITA-4497): the saved card and Tickets, a
 *  matched pair. 40px tall, a 44px tap area. A plain module, so a server
 *  component can read it. */
export const PILL =
  "bg-foreground/15 text-foreground hover:bg-foreground/20 relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold whitespace-nowrap after:absolute after:-inset-y-0.5 after:inset-x-0";

/** Payment Method and Tickets under the Wallet header: half the row each,
 *  48px, DARK (Pato, 2026-11-21, MESITA-4520: "TOP BUTTONS MUST BE DARK"),
 *  like Pay Bill under them. Outlined white from MESITA-4504 until then. */
export const WIDE =
  "bg-foreground text-background hover:bg-foreground/90 relative flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold";
