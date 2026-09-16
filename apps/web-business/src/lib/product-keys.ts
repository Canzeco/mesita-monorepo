// THE PRODUCT VOCABULARY — the eight keys, and nothing else (MESITA-1885).
//
// Split out of `components/console/ProductCatalog.tsx` for the same reason
// `place-tabs.ts` was split out of `place-view.ts`: the names are needed by
// modules that must not drag a React component into their graph. `RAIL_ROWS`
// (lib/console-routes.ts) now names products, and the rail is the one column
// every page renders — importing a "use client" catalogue component to learn
// what a product is CALLED would put the grid in everybody's bundle.
//
// IT IS THE ONLY COPY NOW (MESITA-1900). `ProductCatalog.tsx` kept a second
// `PRODUCT_KEYS` of its own after the split and re-exported nothing, so the
// vocabulary existed twice and `products.ts` imported the type from the
// component while `place-tabs.ts` imported the labels from here. Two lists in
// two files is the drift this file was created to end; the component
// re-exports these now.
//
// Keep this file free of imports. It is the vocabulary alone; `lib/products.ts`
// owns what a product's state IS, and `ProductCatalog.tsx` owns its look.
//
// THE ORDER IS PATO'S (2026-09-16): *"Profile · Costumers // Visits · Orders ·
// Reservations // Rewards · Payments · Credits"*, written as three groups with
// a blank line between them. It is the grid's order and the rail's, because
// two lists in two orders is how an operator learns that one of the two
// screens is lying about which product is which. The blank lines are the
// rail's seams (`RAIL_GROUP_STARTS`) and carry no headings.
//
// ── TWO CHANGES FROM THE 2026-09-15 EIGHT (MESITA-1900) ───────────────────
//
// TERMINAL LEFT. It was `soon` with no engine, no column and no switch: a
// rail row whose only address was a SoonStrip under `products/terminal`.
// Pato's list drops it, and with it go the page, `placeTerminalHref` and
// `isPlaceTerminalPathname` — the two route helpers that existed because that
// one row could not be addressed like the other seven.
//
// REWARDS CAME BACK, AND IT CAME BACK IN THE MONEY GROUP. MESITA-1884 folded
// the Rewards card into Visits on Pato's *"should i separate visits and
// rewards into two?? i don't think so."* This list separates them, and where
// it puts Rewards is the argument: beside Payments and Credits, not beside
// Visits. Rewards is what a place GIVES BACK, which is a money product; Visits
// is the container guests arrive through. So `visit_rewards` and its strategy
// cards are the `rewards` zone now, Visits keeps the internal box, and the
// Visits card stops carrying a rewards clause it no longer owns.
export const PRODUCT_KEYS = [
  "profile",
  "customers",
  "visits",
  "orders",
  "reservations",
  "rewards",
  "pay",
  "credits",
  // THE NINTH (MESITA-1929). Pato, on the catalogue: "where is Capital,
  // include Capital there". It lived only on the marketing site until now.
  "capital",
] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

/** What the rail and the catalogue call each product. "Mesita <noun>" is the
 *  grid's form, where the cards are being compared to each other and the brand
 *  is the point; the rail says the noun alone, because every row in it is
 *  already Mesita's and eight rows of "Mesita …" is a column of one word. */
export const PRODUCT_LABEL: Record<ProductKey, string> = {
  profile: "Profile",
  customers: "Customers",
  visits: "Visits",
  orders: "Orders",
  reservations: "Reservations",
  rewards: "Rewards",
  // "Payments", AND THE CARD SAYS MESITA PAYMENTS (MESITA-1900). MESITA-1884
  // was titled "Pay becomes Payments" and shipped "Pay", because the card said
  // Mesita Pay and one product wearing two nouns in one console is worse than
  // either noun — *"rename both together or neither."* Pato has now written
  // Payments twice, so it is both together: this label and `SPECS` in
  // lib/products.ts changed in one commit.
  //
  // THE KEY STAYS `pay`, deliberately. `/places/<id>/pay`, `PLACE_TABS.pay`
  // and `place_profiles.mesita_pay_enabled` are PERSISTED spellings — an
  // address in a bookmark, a column in the database — and renaming a
  // persisted key to match a label is how a rename costs a migration and a
  // redirect for nothing an operator can see.
  //
  // WHERE THE RENAME STOPS, AND WHY IT STOPS THERE. Two registers keep the
  // old words on purpose:
  //
  //   the STATE FACTS   `lib/state-vocabulary.ts` — a GENERATED file, mirrored
  //                     byte for byte into web-admin, whose labels are pinned
  //                     word for word to Notion Main §11.2 by
  //                     `place-capabilities-contract.test.ts`. It names a
  //                     column's condition, not a thing an operator buys, so
  //                     moving it is a Docs change first.
  //   the GUEST's words  web-consumer still says "Paid with Mesita Pay" on a
  //                     ticket, because that is the checkout METHOD a guest
  //                     picked, not the product a venue buys.
  //
  // Everything an operator reads as THE PRODUCT says Payments: this label, the
  // rail row, the catalogue card, the view heading, the breadcrumb, the ladder
  // rung and the setup page.
  pay: "Payments",
  credits: "Credits",
  capital: "Capital",
};
