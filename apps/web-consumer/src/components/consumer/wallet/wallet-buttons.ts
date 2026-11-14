// The Wallet's two button looks (MESITA-3533): the black primary and the
// outlined secondary.
export const PRIMARY =
  "bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]";
export const SECONDARY =
  "border-border bg-card hover:bg-muted flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition";

// The House Card's actions (MESITA-3868, Pato: "the buttons there floating
// feels weird ... must feel like Apple Wallet like super clean"): three equal
// buttons in the page, an icon over a one-line label, 64px, so "Buy Credits"
// stays on one line on a 320px phone. One of them is filled in the brand's
// pink (MESITA-3802's colour, now on a single button); the others are
// neutral. Only /wallet/<placeId> wears them.
export const ACTION =
  "border-border bg-card text-foreground hover:bg-muted flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold whitespace-nowrap transition active:scale-[0.99]";
export const ACTION_FILLED =
  "border-transparent bg-[var(--brand-pink-600)] text-white flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold whitespace-nowrap transition hover:opacity-90 active:scale-[0.99]";
