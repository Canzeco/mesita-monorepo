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
// PATO'S OWN LIST. MESITA-2011 made it his "Actuales" exactly — Mesita Partner
// 2nd, Online Reputation 3rd, Express Website gone — and MESITA-2013 put Express
// Website back at the bottom: *"add express website product here into sidebar
// menu"*. The order lives in `PRODUCT_ORDER` and this file does not re-spell
// it — a row move is one line over there.
//
// THE LAST ROW IS SOON AGAIN, which brings back the rule it wrote the first
// time: everything-you-can-use-then-everything-you-cannot. It is not a state
// sort — Locked sits above Soon because Locked is a product you can read about
// and go buy, and Soon is one that does not exist at all.
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
 *  payload, which is what keeps `PRODUCT_ORDER` the single source of the rows
 *  that are products — this file does not re-spell them. */
export type SidebarRow =
  | { kind: "place" }
  | { kind: "plan" }
  | { kind: "settings" }
  | { kind: "product"; key: ProductKey }
  | { kind: "roadmap" };

/** A group is a label and its rows. The label is `null` for the first group:
 *  it sits directly under the venue band, and a heading there would be a word
 *  explaining two rows that need no explanation. The other earns its own —
 *  the products and a door onto the rest are worth separating. */
export type SidebarGroup = {
  label: string | null;
  rows: readonly SidebarRow[];
};

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = [
  {
    label: null,
    rows: [
      { kind: "place" },
      // THE PLAN ROW IS BACK (MESITA-2012), and MESITA-2011's note is left
      // below it because the reversal is the interesting part.
      //
      // Pato, seeing the ladder on the Mesita Partner product: *"this goes
      // into plan, not mesita partner, different things."* Partner stays a
      // product — it is a fact a guest reads, like the other nine — and what
      // comes back out of it is the PURCHASE. A rung has a price, a renewal
      // date and a card; a badge has none of those and cannot be switched at
      // all. One screen was answering both.
      //
      // BETWEEN PLACE AND SETTINGS: the place, what it pays, how it is run.
      // It is the middle of the three because Settings is the last-resort row
      // and must stay the foot of this group.
      { kind: "plan" },
      { kind: "settings" },
      // MESITA-2011's note, kept: *"casi que partner lo quiero meter como un
      // producto"* put Mesita Partner second in the Products group, and that
      // still holds — `{ kind: "product", key: "partner" }`, drawn by the map
      // below like every other row. What that issue ALSO did was treat the
      // product row as a replacement for this one, which is the half
      // MESITA-2012 undoes.
    ],
  },
  {
    label: "Products",
    rows: [
      ...PRODUCT_ORDER.map((key) => ({ kind: "product", key }) as const),
      // THE LAST ROW IS A DOOR, NOT A PRODUCT (MESITA-2005), and it is last
      // because it is the only row here you cannot switch on. Its badge is a
      // COUNT where the products above carry a state, which is the one thing
      // that still separates it now that the band is gone — and a number is
      // also the one thing worth reading before opening a list.
      //
      // It hides itself when the count is zero, and the group's label does NOT
      // go with it: the product rows still need it. That is a difference from
      // the band it replaces, where the label had nothing left to introduce.
      { kind: "roadmap" },
    ],
  },
];

export const SIDEBAR_PLACE_LABEL = "Place";
export const SIDEBAR_PLAN_LABEL = "Plan";
export const SIDEBAR_SETTINGS_LABEL = "Settings";
export const SIDEBAR_ROADMAP_LABEL = "Future products";

/** The marks for the rows that are not products. Products read
 *  `PRODUCT_MARK`, which is already the one list of those. */
export const SIDEBAR_PLACE_MARK = "\u{1F4CD}";
// A CARD, NOT THE HANDSHAKE. The handshake is `PRODUCT_MARK.partner` and stays
// there: two rows wearing one mark would say the two are the same screen,
// which is the confusion MESITA-2012 exists to end.
export const SIDEBAR_PLAN_MARK = "\u{1F4B3}";
export const SIDEBAR_SETTINGS_MARK = "\u{2699}\u{FE0F}";
export const SIDEBAR_ROADMAP_MARK = "\u{1F52E}";
