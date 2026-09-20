// WHICH PRODUCTS ACTUALLY HAVE TWO HALVES (MESITA-2004).
//
// Pato, 2026-09-19: *"AND EACH PRODUCT IS DIVIDED INTO SETUP AND ACTIVITY.
// EASY."* It is not easy, because it is not true: of the eleven products in
// `PRODUCT_ORDER`, THREE divide. The other eight are ONE screen each — six of
// them a config, two of them a log — and a `Setup | Activity` pair drawn on top
// of them would be a control that does nothing on eight screens out of eleven,
// which is the decoration `TopNav` wrote its own law against:
//
//   *"A destination a caller cannot reach is NOT RENDERED. A menu where some
//    entries are real and some are decoration is a menu you stop reading."*
//
// `TopNav` is gone and that law is not. This file is where it lives now.
//
// ── WHY IT IS DECLARED AND NOT DERIVED ─────────────────────────────────────
//
// The obvious implementation is to ask the view whether it has an Activity
// half. You cannot: `Half` is a REACT CONTEXT consumed at render time, so by
// the time anything could answer, the pane is already drawing. The sidebar and
// the pane HEADER both need the answer BEFORE render — the header to decide
// whether to draw a tab pair at all, the router to decide whether
// `/activity/<slug>` is even an address.
//
// So it is written down. `Record<ProductKey, …>` makes completeness compiler-
// enforced, which is the idiom this repo already uses for exactly this kind of
// list (`BANDED_KEYS` in `product-keys.ts`).
//
// ── THE OBLIGATION THIS FILE CARRIES ───────────────────────────────────────
//
// A hand-typed map rots, and THIS PACKAGE HAS NO TEST RUNNER — `package.json`
// has `lint` and `typecheck` and nothing else, so there is no file that can
// assert the map and the views agree. What holds them together instead is the
// ROUTE: `activity/[product]/page.tsx` calls `notFound()` for any product this
// map does not give an `"activity"` to. The map is not documentation about the
// router, it IS the router — so a wrong entry is a 404 you meet immediately,
// not a blank pane you find in a month.
//
// The remaining edge the compiler cannot see: declaring a product `["products",
// "activity"]` when its view has no `Half label="Activity"` block. That renders
// an empty Activity pane. Adding a product here means opening its view and
// confirming the block exists.
import type { ProductKey } from "@/lib/product-keys";
import type { PlaceHalf } from "@/lib/product-routes";

const BOTH: readonly PlaceHalf[] = ["products", "activity"];
const SETUP_ONLY: readonly PlaceHalf[] = ["products"];
const ACTIVITY_ONLY: readonly PlaceHalf[] = ["activity"];

/** THE PARTITION, one entry per product, audited 2026-09-19 against the
 *  `Half` markers in `src/components/views/`.
 *
 *  `"products"` is the Setup half — the segment keeps its old name because
 *  renaming it touches `product-routes.ts`, every `productHref` caller and the
 *  Activity twin, and a pasted link is written down in blocker rows
 *  (MESITA-2001 made the same call for the LABEL). Every product has one:
 *  even a Soon product has a Setup screen, it just says it is not here yet.
 *
 *  `"activity"` is granted only where the view really carries a
 *  `Half label="Activity"` block. */
export const PRODUCT_HALVES: Record<ProductKey, readonly PlaceHalf[]> = {
  // ── THE FOUR THAT DIVIDE ─────────────────────────────────────────────────
  // Config above, log below, and both are worth a screen.
  visits: BOTH,
  orders: BOTH,
  reservations: BOTH,
  // The Developers Platform got its Manage half in MESITA-1992 (the key and
  // the connector) and keeps the Activity half that says where its events
  // land. It is not in `PRODUCT_ORDER`, so no sidebar row opens it today.
  access: BOTH,

  // ── ONE SCREEN, AND IT IS THE LOG ────────────────────────────────────────
  //
  // CREDITS HAS NOTHING TO CONFIGURE, and that is a ruling rather than an
  // oversight. MESITA-2003 moved every `Tiles` block on this view inside the
  // Activity half and took the on/off tile with it: *"the on/off tile goes
  // with them and is no loss — a product's state is already the badge beside
  // its name at the top of the pane, so the tile was the same fact twice."*
  // What is left outside a half is the heading, which `ProductPane` draws.
  //
  // So its Setup ADDRESS 404s, its sidebar row opens the log, and it draws no
  // tab pair — one screen, named once. An earlier pass of this issue gave it a
  // Manage half holding two tiles; that was written before MESITA-2003 landed
  // and it would have re-introduced the exact numbers that issue removed.
  //
  // It gets a Manage half the day Credits gets a real dial — pack sizes, an
  // expiry, a sale switch. Then this entry becomes `BOTH` and the pair appears
  // on its own.
  credits: ACTIVITY_ONLY,

  // ONLINE REVIEWS, ON CREDITS' PRECEDENT (MESITA-2011). Nothing here can be
  // configured — four sources, all of them writing from outside — so a Setup
  // half would be a stated absence forever, which is the exact argument
  // MESITA-2007 used to fold this product into Profile in the first place.
  //
  // IT IS THE REASON THE FOLD WAS WRONG, TOO. A product with one half is a
  // shape this file already has; it does not have to borrow somebody else's
  // row to get it.
  //
  // `ReviewsView` renders on both surfaces (its own header says so, and
  // nothing in it sits inside a `Half`), so it is THIS LINE that keeps
  // `/products/online-reviews` from serving the same screen the Activity
  // address does. The router reads the map; the map is the only gate.
  reviews: ACTIVITY_ONLY,

  // ── ONE SCREEN EACH, AND IT IS THE CONFIG ────────────────────────────────
  // Four live products whose whole surface is configuration — Profile joined
  // them in MESITA-2011. They used to render that configuration at BOTH
  // addresses, because `ProductPane` returned the view without ever reading
  // `useHalf()`.
  menu: SETUP_ONLY,
  pay: SETUP_ONLY,
  // MESITA PROFILE IS BACK TO ONE SCREEN (MESITA-2011). Its Activity half was
  // Online Reviews, mounted here by MESITA-2007; Reviews has its own row
  // again, so what is left is what Profile always was — the thing an operator
  // sets.
  profile: SETUP_ONLY,
  // MESITA PARTNER HAS NO LOG (MESITA-2011), and the pane it replaced already
  // said so in prose at its Activity address: renewals, a failed card and a
  // cancellation are `SUBSCRIPTION` rows and Stripe's invoices, never a second
  // timeline here. A sentence explaining an empty screen is still an empty
  // screen, so the address goes rather than the sentence staying.
  partner: SETUP_ONLY,

  // A stated absence is still a Setup screen, and both of these have a sidebar
  // row that opens it. `line` is Locked and `website` is Soon; `ProductPane`
  // draws the pane that says so.
  line: SETUP_ONLY,
  website: SETUP_ONLY,

  // ── THE ROADMAP ──────────────────────────────────────────────────────────
  // Eight products with nothing to open. `website` is NOT among them any more
  // — MESITA-2013 gave it a sidebar row back, and it is declared with the
  // other stated absences above. These eight are reached from the Future
  // products door, never from a sidebar row, and none of them has a log.
  customers: SETUP_ONLY,
  ads: SETUP_ONLY,
  tableorders: SETUP_ONLY,
  terminal: SETUP_ONLY,
  pos: SETUP_ONLY,
  orderpad: SETUP_ONLY,
  capital: SETUP_ONLY,
  intelligence: SETUP_ONLY,
};

/** Does this product have this half? The router asks before it serves. */
export function hasHalf(key: ProductKey, half: PlaceHalf): boolean {
  return PRODUCT_HALVES[key].includes(half);
}

/** Does this product draw a `Setup | Activity` pair?
 *
 *  Only when it HAS both. Seven of the ten answer `false`, and on those the
 *  pane header draws no tabs at all rather than one tab, or two where one is
 *  dead. */
export function isSplit(key: ProductKey): boolean {
  return hasHalf(key, "products") && hasHalf(key, "activity");
}

/** THE HALF A SIDEBAR ROW OPENS — the first one the product has.
 *
 *  Setup for eight of the nine, because a product you can configure opens on its
 *  configuration. Prepaid Credits has no Setup half at all, so its row opens
 *  the log; a row pointing at `/products/prepaid-credits` would be a menu
 *  entry onto a 404, which is the failure `PRODUCT_HALVES` exists to make
 *  impossible rather than to cause. */
export function primaryHalf(key: ProductKey): PlaceHalf {
  return PRODUCT_HALVES[key][0];
}
