// THE PRODUCT VOCABULARY — the eight keys, and nothing else (MESITA-1885).
//
// Split out of `components/console/ProductCatalog.tsx` for the same reason
// `place-tabs.ts` was split out of `place-view.ts`: the names are needed by
// modules that must not drag a React component into their graph. `RAIL_ROWS`
// (lib/console-routes.ts) now names products, and the rail is the one column
// every page renders — importing a "use client" catalogue component to learn
// what a product is CALLED would put the grid in everybody's bundle.
//
// Keep this file free of imports. It is the vocabulary alone; `lib/products.ts`
// owns what a product's state IS, and `ProductCatalog.tsx` owns its look.
//
// THE ORDER IS PATO'S (2026-09-15): *"Profile · Costumers · Visits · Orders ·
// Reservations · Payments · Credits · Terminal"*. It is the grid's order and
// the rail's, because two lists in two orders is how an operator learns that
// one of the two screens is lying about which product is which.
export const PRODUCT_KEYS = [
  "profile",
  "customers",
  "visits",
  "orders",
  "reservations",
  "pay",
  "credits",
  "terminal",
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
  // "Pay", not "Payments" — Pato's list says Payments, but the CARD says
  // Mesita Pay (MESITA-1884 kept the brand: it reaches 69 files including
  // consumer disclosure copy). One product wearing two nouns in one console
  // is worse than either noun. Rename both together or neither.
  pay: "Pay",
  credits: "Credits",
  terminal: "Terminal",
};
