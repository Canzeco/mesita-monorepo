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
// the headers … a bit gray, just a bit, minimum"): the title strip wears
// bg-muted at 50%, the lightest grey step; the rows stay white.
export const SECTION_TITLE = "text-foreground border-border border-b px-3 py-3 text-base font-semibold bg-muted/50";
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
