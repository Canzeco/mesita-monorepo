// PAY'S TWO BOXES (Pato, 2026-11-21, MESITA-4560: "a card that says payment
// method, and below a box that says loyalty cards"). TITLES INSIDE, ON WHITE
// (Pato, 2026-11-21, MESITA-4574: "payment method and loyalty cards each in
// its own card. i don't want floating strings … MAKE ALL BACKGROUND WHITE"):
// each section is one bordered white card, its title at the card's top left
// (16px semibold, 12px in like the rows), the rows under it with a hairline
// between them. The title floated over the box on a grey ground before
// (MESITA-4560/4562). A HAIRLINE UNDER THE TITLE (Pato, 2026-11-21,
// MESITA-4579: "it looks super weird and ugly that there is no line division
// between payment method and first item"): the rows' own line, 12px under
// the words.
export const SECTION_CARD = "border-border bg-card mt-2 overflow-hidden rounded-2xl border";
// A FAINT GREY STRIP (Pato, 2026-11-21, MESITA-4605: "add a bit of color to
// the headers … a bit gray, just a bit, minimum"): the title strip is grey,
// the rows stay white. A BIT DARKER (MESITA-4610, Pato: "better do payment
// methods and loyalty cards a bit darker"): the full bg-muted, not 50%.
// ALL WHITE (Pato, 2026-11-23, MESITA-4753: "make loyalty cards all white,
// even in the header"): the strip is the card's own white; the hairline under
// it stays.
export const SECTION_TITLE = "text-foreground border-border bg-card border-b px-3 py-3 text-base font-semibold";
export const SECTION_ROWS = "divide-border flex flex-col divide-y";

// ONE SIZE SCALE (Pato, 2026-11-21, MESITA-4578: "standarize … sizes and
// fonts in this … page"): Pay speaks four sizes — 20 the page title, 18 the
// three big buttons, 16 every row name, section title and amount, 14 the
// secondary words — all semibold, never bold. Every row of a box is 56px with
// one 48x32 thumbnail; chevrons 20px, glyphs inside a thumbnail 16px. Before:
// the method row 56px over ~46px Loyalty Card rows, a 51x32 chip over 40x26
// photos, the balance bold.
/** A row of a Pay box: 56px, 12px in, the thumbnail 12px from the words. */
export const PAY_ROW = "flex h-14 w-full min-w-0 items-center gap-3 px-3 text-left";
/** The row's thumbnail: the method chip, the Loyalty Card's photo, the + chip. */
export const PAY_THUMB = "flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md";
/** The row's main words, and its amount (add `shrink-0 tabular-nums`). */
export const PAY_ROW_TEXT = "text-foreground text-base font-semibold";
/** The row's secondary words: a distance, a note. */
export const PAY_ROW_META = "text-muted-foreground text-sm";

/** The Wallet's two modals (MESITA-4846): `?tab=` names the open one, so the
 *  phone's Back closes it and Back from a place lands in it. */
export const PAY_MODALS = ["prepay", "pay"] as const;
export type PayModal = (typeof PAY_MODALS)[number];
export function readPayModal(v: string | null | undefined): PayModal | null {
  return PAY_MODALS.find((t) => t === v) ?? null;
}
export function payModalPath(t: PayModal): string {
  return `/pay?tab=${t}`;
}
/** Each tile's own colour; its modal wears it too. */
export const PAY_FILL: Record<PayModal, string> = {
  prepay: "bg-[#635BFF] text-white",
  pay: "bg-[#00D66F] text-neutral-950",
};
/** A tile: half the row, 8:5 (Pato, MESITA-4852; a square before). */
export const PAY_TILE = "flex aspect-[8/5] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl p-1 text-center";
