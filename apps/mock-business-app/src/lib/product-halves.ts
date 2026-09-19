// WHICH PRODUCTS ACTUALLY HAVE TWO HALVES (MESITA-2004).
//
// Pato, 2026-09-19: *"AND EACH PRODUCT IS DIVIDED INTO SETUP AND ACTIVITY.
// EASY."* It is not easy, because it is not true: of the ten products in
// `PRODUCT_ORDER`, FOUR divide. The other six are one screen each, and a
// `Setup | Activity` pair drawn on top of them would be a control that does
// nothing on six screens out of ten — which is the decoration `TopNav` wrote
// its own law against:
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
  // CREDITS EARNED ITS MANAGE HALF IN THIS ISSUE. It had a `Half label=
  // "Activity"` and nothing wrapping the rest, and `Half` only hides what is
  // WRAPPED — so its config rendered on the Activity half too and the log
  // screen was the setup screen plus a table. The switch band is wrapped now.
  credits: BOTH,
  // The Developers Platform got its Manage half in MESITA-1992 (the key and
  // the connector) and keeps the Activity half that says where its events
  // land. It is not in `PRODUCT_ORDER`, so no sidebar row opens it today.
  access: BOTH,

  // ── ONE SCREEN EACH ──────────────────────────────────────────────────────
  // These four are live products whose whole surface is configuration. They
  // used to render that configuration at BOTH addresses, because `ProductPane`
  // returned the view without ever reading `useHalf()`.
  profile: SETUP_ONLY,
  reviews: SETUP_ONLY,
  menu: SETUP_ONLY,
  pay: SETUP_ONLY,

  // A stated absence is still a Setup screen. `line` is Locked and `website`
  // is Soon; `ProductPane` draws the pane that says so.
  line: SETUP_ONLY,
  website: SETUP_ONLY,

  // ── THE ROADMAP ──────────────────────────────────────────────────────────
  // Nine products with nothing to open. They are reached from the Future
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
 *  Only when it HAS both. Six of the ten answer `false`, and on those the pane
 *  header draws no tabs at all rather than one tab, or two where one is dead. */
export function isSplit(key: ProductKey): boolean {
  return hasHalf(key, "products") && hasHalf(key, "activity");
}
