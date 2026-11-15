// The Wallet's two button looks (MESITA-3533): the black primary and the
// outlined secondary.
export const PRIMARY =
  "bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]";
export const SECONDARY =
  "border-border bg-card hover:bg-muted flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition";

// THE FOUR DOORS (MESITA-4031..4087): Wallet's row of four equal buttons,
// an icon over a label that may wrap, 52px, each kind its own soft tint
// (MESITA-4054). Wallet wears Buy · Send · Claim · Share Mesita; a House Card
// wears the same four with Go to Pay in Share Mesita's place (MESITA-4095,
// Pato: "the same 4 buttons, the same sizes, but instead of saying share
// mesita, mention go to pay").
export const DOOR_ROW = "grid grid-cols-4 gap-2";
const DOOR =
  "type-body flex h-13 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center leading-tight font-semibold text-white transition hover:opacity-90 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
/** Buy Credits: the one solid black door. */
export const DOOR_BUY = `${DOOR.replace("text-white", "text-paper")} bg-foreground focus-visible:ring-neutral-400`;
/** Send Gift and Claim Gift: green tint. */
export const DOOR_GIFT = `${DOOR.replace("text-white", "text-emerald-800")} bg-emerald-50 ring-1 ring-inset ring-emerald-200 focus-visible:ring-emerald-400`;
/** Share Mesita on Wallet, Go to Pay on a House Card: pink tint. */
export const DOOR_PINK = `${DOOR.replace("text-white", "text-pink-700")} bg-pink-50 ring-1 ring-inset ring-pink-200 focus-visible:ring-pink-400`;
export const DOOR_GLYPH = "h-4 w-4 shrink-0";
