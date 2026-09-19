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
// Pato's nine products, with two entries he did not name:
//
// ONLINE REVIEWS, restored to its `PRODUCT_ORDER` position. It left Profile and
// became its own product three commits before this issue (MESITA-1993), so a
// nine-row list is a ten-row suite with the newest member missing. It sits 2nd,
// where `PRODUCT_ORDER` already puts it.
//
// EXPRESS WEBSITE stays LAST, which is where Pato put it and is a move away
// from `PRODUCT_ORDER`'s 3rd. The rule it implies is worth writing down because
// the next row move will need it: EVERYTHING YOU CAN USE, THEN EVERYTHING YOU
// CANNOT. `website` is Soon. It is not a strict state sort — `line` is Locked
// and sits above it — because Locked is a product that EXISTS behind a rung
// and Soon is a product that does not exist at all, and only the second one
// has nothing whatever to look at.
//
// ── THE ROW PATO DID NOT ASK FOR, AND WHY IT IS HERE ───────────────────────
//
// `kind: "log"` — the place's WHOLE activity, `/places/<id>/activity`. It
// shipped the day before this issue (MESITA-1988, *"Activity is one screen"*)
// and Pato's three-row first group has no door onto it.
//
// decision: it gets a row, between Place and Settings. Two things make the cost
// of dropping it concrete rather than theoretical. It is the only screen that
// answers "what happened here" across products — the per-product Activity
// halves are four of ten. And `ProductPane` SAYS SO IN COPY: a live product
// with no log of its own tells the operator its events *"show up in this
// place's whole log, one screen back"*. Delete the row and that sentence points
// at nothing, on six screens.
//
// It sits in the first group because it is a fact about the PLACE, not about a
// product — the same reason Place and Settings are there. Reverse this the
// first time the per-product halves cover enough of the suite that the whole-
// place log stops being the only answer.
import { PRODUCT_ORDER } from "@/lib/product-routes";
import type { ProductKey } from "@/lib/product-keys";

/** A row names one destination. `product` is the only kind that carries a
 *  payload, which is what keeps `PRODUCT_ORDER` the single source of the ten
 *  that are products — this file does not re-spell them. */
export type SidebarRow =
  | { kind: "place" }
  | { kind: "log" }
  | { kind: "settings" }
  | { kind: "plan" }
  | { kind: "product"; key: ProductKey }
  | { kind: "roadmap" };

/** A group is a label and its rows. The label is `null` for the first group:
 *  it sits directly under the venue band, and a heading there would be a word
 *  explaining three rows that need no explanation. The other two earn theirs —
 *  ten products and a door onto nine more are worth separating. */
export type SidebarGroup = {
  label: string | null;
  rows: readonly SidebarRow[];
};

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = [
  {
    label: null,
    rows: [
      { kind: "place" },
      { kind: "log" },
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
    rows: PRODUCT_ORDER.map((key) => ({ kind: "product", key }) as const),
  },
  {
    label: "Roadmap",
    // ONE ROW FOR THE WHOLE ROADMAP, and its badge is a COUNT rather than a
    // state: the row is not a product, it is a door onto a list, and a number
    // is the one thing worth reading before opening it. The row hides itself
    // when the count is zero — see `Sidebar.tsx`.
    rows: [{ kind: "roadmap" }],
  },
];

export const SIDEBAR_PLACE_LABEL = "Place";
export const SIDEBAR_LOG_LABEL = "Activity";
export const SIDEBAR_SETTINGS_LABEL = "Settings";
export const SIDEBAR_PLAN_LABEL = "Plan";
export const SIDEBAR_ROADMAP_LABEL = "Future products";

/** The marks for the rows that are not products. Products read
 *  `PRODUCT_MARK`, which is already the one list of those. */
export const SIDEBAR_PLACE_MARK = "\u{1F4CD}";
export const SIDEBAR_LOG_MARK = "\u{1F4C8}";
export const SIDEBAR_SETTINGS_MARK = "\u{2699}\u{FE0F}";
export const SIDEBAR_PLAN_MARK = "\u{1F91D}";
export const SIDEBAR_ROADMAP_MARK = "\u{1F52E}";
