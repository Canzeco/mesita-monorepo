// The Wallet's two button looks (MESITA-3533): the black primary and the
// outlined secondary.
export const PRIMARY =
  "bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]";
export const SECONDARY =
  "border-border bg-card hover:bg-muted flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition";

// THE DOORS (MESITA-4031..4087): Wallet's row of equal buttons,
// an icon over a label that may wrap, 52px, each kind its own soft tint
// (MESITA-4054). Wallet wears Buy · Send · Claim · Share Mesita; a House Card
// wears the same four with Go to Pay in Share Mesita's place (MESITA-4095,
// Pato: "the same 4 buttons, the same sizes, but instead of saying share
// mesita, mention go to pay").
export const DOOR_ROW = "grid grid-cols-3 gap-2";
const DOOR =
  "type-body flex h-13 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center leading-tight font-semibold text-white transition hover:opacity-90 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
/** Wallet's three doors (MESITA-4232): one colour for all three, soft grey
 *  with black ink, so the black Pay Bill is the page's one dark thing
 *  (MESITA-4254; they were black for an hour in MESITA-4250, Pato: "maybe do
 *  the buttons three buttons dark"). The House Card wears them under its Pay
 *  bar since MESITA-4253. */
export const DOOR_QUIET = `${DOOR.replace("text-white", "text-foreground")} bg-muted hover:bg-border focus-visible:ring-neutral-400`;
export const DOOR_GLYPH = "h-4 w-4 shrink-0";

// THE HOUSE CARD'S PAY BAR (MESITA-4253, Pato over four drawings: "Build
// A"): spending the credit is why the card is open, so Pay is one full-width
// bar in the Pay tab's Pay Bill pink, 60px, the QR glyph, "Pay here" over a
// line naming the balance, a chevron; Buy Credits and Send Gift sit under it
// as two DOOR_QUIET doors, the Wallet's grey look.
export const PAY_BAR =
  "flex h-15 w-full items-center gap-3 rounded-xl bg-[var(--brand-pink-600)] px-4 text-left text-white transition hover:bg-[var(--brand-pink-700)] active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink-300)] focus-visible:ring-offset-2";
/** The two doors under the Pay bar. */
export const DOOR_ROW_TWO = "grid grid-cols-2 gap-2";
