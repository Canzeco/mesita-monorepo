// The Wallet's two button looks (MESITA-3533): the black primary and the
// outlined secondary.
export const PRIMARY =
  "bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]";
export const SECONDARY =
  "border-border bg-card hover:bg-muted flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition";

// The House Card page's buttons in the brand's pink (MESITA-3802, Pato: "put
// colors to this stupid buttons for them to be visible"): a filled pink
// primary and a pale pink secondary. Only /wallet/<placeId> wears them.
export const PINK_PRIMARY =
  "bg-[var(--brand-pink-600)] text-white flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]";
export const PINK_SECONDARY =
  "border-[var(--brand-pink-200)] bg-[var(--brand-pink-50)] text-(--brand-pink-700) hover:bg-[var(--brand-pink-100)] flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition";
