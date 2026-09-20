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
// two hard-coded bands. This holds every destination there is, and the law
// each of them wrote survives: THERE IS NO SECOND LIST. Moving a row is an
// edit to one line here — or, for a product, in `PRODUCT_ORDER`.
//
// ── THE ORDER ──────────────────────────────────────────────────────────────
//
// PATO'S TEN, AND IT IS HIS "ACTUALES" LIST EXACTLY (MESITA-2011). Mesita
// Partner is 2nd and Online Reviews 3rd; Express Website leaves, because he
// put it in Futuros. The order lives in `PRODUCT_ORDER` and this file does not
// re-spell it — a row move is one line over there.
//
// NOTHING IN THE LIST IS SOON ANY MORE, which retires the rule the old ninth
// row wrote: everything-you-can-use-then-everything-you-cannot, invented so
// `website` could sit last without the list becoming a state sort. It comes
// back the day an unbuilt product earns a row again.
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
  | { kind: "product"; key: ProductKey }
  | { kind: "roadmap" };

/** A group is a label and its rows. The label is `null` for the first group:
 *  it sits directly under the venue band, and a heading there would be a word
 *  explaining two rows that need no explanation. The other earns its own —
 *  ten products and a door onto the rest are worth separating. */
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
      // THE PLAN ROW IS GONE (MESITA-2011). It sat here because it was what
      // the products are bought with rather than one of them — and Pato has
      // made it one of them: *"casi que partner lo quiero meter como un
      // producto"*, second on his list. It is `{ kind: "product", key:
      // "partner" }` now, drawn by the map below like every other row, and
      // this group is back to the two destinations that are not products.
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
      // go with it: ten other rows still need it. That is a difference from
      // the band it replaces, where the label had nothing left to introduce.
      { kind: "roadmap" },
    ],
  },
];

export const SIDEBAR_PLACE_LABEL = "Place";
export const SIDEBAR_SETTINGS_LABEL = "Settings";
export const SIDEBAR_ROADMAP_LABEL = "Future products";

/** The marks for the rows that are not products. Products read
 *  `PRODUCT_MARK`, which is already the one list of those. */
export const SIDEBAR_PLACE_MARK = "\u{1F4CD}";
export const SIDEBAR_SETTINGS_MARK = "\u{2699}\u{FE0F}";
// The handshake went WITH the Plan row — it is `PRODUCT_MARK.partner` now.
export const SIDEBAR_ROADMAP_MARK = "\u{1F52E}";
