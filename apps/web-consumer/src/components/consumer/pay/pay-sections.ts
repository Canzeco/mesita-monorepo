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
export const SECTION_TITLE = "text-foreground border-border border-b px-3 py-3 text-base font-semibold";
export const SECTION_ROWS = "divide-border flex flex-col divide-y";
