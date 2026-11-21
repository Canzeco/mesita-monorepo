/** The Wallet header's pill (MESITA-4497): the saved card and Tickets, a
 *  matched pair. 40px tall, a 44px tap area. A plain module, so a server
 *  component can read it. */
export const PILL =
  "bg-foreground/15 text-foreground hover:bg-foreground/20 relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold whitespace-nowrap after:absolute after:-inset-y-0.5 after:inset-x-0";

/** Payment Method and Tickets under the Wallet band (MESITA-4504): half the
 *  row each, outline, 48px. Pay below them is the only filled control. */
export const WIDE =
  "border-border bg-card text-foreground relative flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold";
