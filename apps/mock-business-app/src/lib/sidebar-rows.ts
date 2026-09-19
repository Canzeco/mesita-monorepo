// THE MENU — ONE ARRAY, AGAIN, AND NOW IT IS THE WHOLE MENU (MESITA-2004).
//
// Pato, 2026-09-19: *"maybe lets return to the original sidebar menu
// configuration. at the top, mesita logo. (together) the place then settings
// (then all the produtcs). AND EACH PRODUCT IS DIVIDED INTO SETUP AND
// ACTIVITY. EASY. ALL IN SIDEBAR MENU"*.
//
// ── WHAT THIS REPLACES ─────────────────────────────────────────────────────
//
// `NAV_ROWS` in `console-routes.ts`, which held FOUR destinations across one
// ink line (MESITA-1975). Before that, `RAIL_ROWS`, which held two rows between
// two hard-coded bands. This holds all fifteen, and the law each of them wrote
// survives: THERE IS NO SECOND LIST. Moving a row is an edit to one line here.
//
// ── THE ORDER ──────────────────────────────────────────────────────────────
//
// PATO'S NINE, AND IT IS EXACTLY HIS NINE AGAIN (MESITA-2007). MESITA-2004
// added a tenth — Online Reviews, which had left Profile to become its own
// product days earlier (MESITA-1993) — on the argument that a nine-row list
// was a ten-row suite with its newest member missing. Reviews has gone back
// inside Profile as its Activity half, so the list is the one Pato wrote.
//
// EXPRESS WEBSITE stays LAST, which is where Pato put it and is a move away
// from `PRODUCT_ORDER`'s 3rd. The rule it implies is worth writing down because
// the next row move will need it: EVERYTHING YOU CAN USE, THEN EVERYTHING YOU
// CANNOT. `website` is Soon. It is not a strict state sort — `line` is Locked
// and sits above it — because Locked is a product that EXISTS behind a rung
// and Soon is a product that does not exist at all, and only the second one
// has nothing whatever to look at.
//
// ── THE ACTIVITY ROW IS GONE, AND SO IS THE ROADMAP BAND (MESITA-2005) ─────
//
// Pato, 2026-09-19, looking at the console MESITA-2004 shipped: *"REMOVE
// ACTIVITY. EACH PRODUCT HAS OWN. FUTURE PRODUCTS AS A FINAL ITEM IN PRODUCTS,
// NOT AS AN EXTRA SECTION."*
//
// THE WHOLE-PLACE LOG LOSES ITS ROW. MESITA-2004 gave it one against Pato's own
// three-row list, on the argument that it is the only screen answering "what
// happened here" across products and that three panes point at it in copy. He
// has now seen that console and overruled it: activity is a thing a PRODUCT
// has, and a row for the union of them is a second way to read what the
// products already say.
//
// THE SCREEN STAYS AT ITS ADDRESS. `AskBar`'s *"How did today go?"* — one of
// the four openers on Home — still doors onto it, so this deletes a menu row
// rather than a destination. What did change is the three sentences that told
// an operator their events were *"one screen back"*: with no row, that is a
// direction rather than a fact, so they now state the fact alone.
//
// decision: the screen survives the row. Delete it outright the day the AskBar
// opener stops pointing at it, and not before — a 400-row cross-product feed
// with a CSV export is not something to drop as a side effect of a menu edit.
//
// ── THE ROADMAP IS A ROW, NOT A BAND ───────────────────────────────────────
//
// `Future products` was its own group under its own label, on the argument that
// a door onto a list is not a product with a state and a bare count in a badge
// column reads as a badge that failed to render. Pato's answer is that a band
// of one is more furniture than that badge ever was: two labels and a card
// boundary to introduce a single row. It is the last row of Products now, where
// its count sits in the same column as the states and reads as one more thing
// you can open.
import { PRODUCT_ORDER } from "@/lib/product-routes";
import type { ProductKey } from "@/lib/product-keys";

/** A row names one destination. `product` is the only kind that carries a
 *  payload, which is what keeps `PRODUCT_ORDER` the single source of the ten
 *  that are products — this file does not re-spell them. */
export type SidebarRow =
  | { kind: "place" }
  | { kind: "settings" }
  | { kind: "plan" }
  | { kind: "product"; key: ProductKey }
  | { kind: "roadmap" };

/** A group is a label and its rows. The label is `null` for the first group:
 *  it sits directly under the venue band, and a heading there would be a word
 *  explaining three rows that need no explanation. The other two earn theirs —
 *  nine products and a door onto the rest are worth separating. */
export type SidebarGroup = {
  label: string | null;
  rows: readonly SidebarRow[];
};

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = [
  {
    label: null,
    rows: [
      { kind: "place" },
      { kind: "settings" },
      // THE PLAN IS NOT ONE OF THE TEN and must not become one — it is what
      // the ten are bought with. `ProductShell` kept it in its own card under
      // its own "Your plan" band for that reason; here the group boundary does
      // the same work with one fewer object.
      { kind: "plan" },
    ],
  },
  {
    label: "Products",
    rows: [
      ...PRODUCT_ORDER.map((key) => ({ kind: "product", key }) as const),
      // THE ELEVENTH ROW IS A DOOR, NOT A PRODUCT (MESITA-2005), and it is
      // last because it is the only row here you cannot switch on. Its badge is
      // a COUNT where the ten above carry a state, which is the one thing that
      // still separates it now that the band is gone — and a number is also the
      // one thing worth reading before opening a list.
      //
      // It hides itself when the count is zero, and the group's label does NOT
      // go with it: nine other rows still need it. That is a difference from
      // the band it replaces, where the label had nothing left to introduce.
      { kind: "roadmap" },
    ],
  },
];

export const SIDEBAR_PLACE_LABEL = "Place";
export const SIDEBAR_SETTINGS_LABEL = "Settings";
export const SIDEBAR_PLAN_LABEL = "Plan";
export const SIDEBAR_ROADMAP_LABEL = "Future products";

/** The marks for the rows that are not products. Products read
 *  `PRODUCT_MARK`, which is already the one list of those. */
export const SIDEBAR_PLACE_MARK = "\u{1F4CD}";
export const SIDEBAR_SETTINGS_MARK = "\u{2699}\u{FE0F}";
export const SIDEBAR_PLAN_MARK = "\u{1F91D}";
export const SIDEBAR_ROADMAP_MARK = "\u{1F52E}";
