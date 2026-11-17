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
/** Wallet's doors (MESITA-4232): Send Gift and Share Mesita since
 *  MESITA-4269. Dark since MESITA-4269 (Pato: "make the buttons below dark,
 *  like the 5 buttons color in mesita profile"): the place screen's tile
 *  colour, bg-foreground with paper ink; grey in MESITA-4254, black in
 *  MESITA-4250. The House Card's doors under its Pay bar wear them too. */
export const DOOR_QUIET = `${DOOR.replace("text-white", "text-paper")} bg-foreground hover:opacity-90 focus-visible:ring-neutral-400`;
export const DOOR_GLYPH = "h-4 w-4 shrink-0";
/** Wallet's three doors wear emojis (MESITA-4260, Pato: "maybe use emojis
 *  for those three … whatever you think is a great clean design"): 💳 Buy
 *  Credits, 🎁 Send Gift, 💌 Share Mesita, one size over grey. */
export const DOOR_EMOJI = "text-lg leading-none";

