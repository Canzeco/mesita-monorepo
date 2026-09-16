// THE PRODUCT VOCABULARY — the eight keys, and nothing else.
//
// Snapshot of `apps/web-business/src/lib/product-keys.ts`. Kept free of
// imports for the same reason the original is: `RAIL_ROWS` names products and
// the rail is the one column every page renders, so learning what a product is
// CALLED must not drag the catalogue grid into every bundle.
//
// THE ORDER IS PATO'S (2026-09-16): *"Profile · Costumers // Visits · Orders ·
// Reservations // Rewards · Payments · Credits"* — three groups with a blank
// line between them. The blank lines are the rail's seams
// (`RAIL_GROUP_STARTS`) and carry no headings.
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

/** What the rail and the catalogue call each product. The rail says the noun
 *  alone; the grid says "Mesita <noun>", where the cards are being compared to
 *  each other and the brand is the point. */
export const PRODUCT_LABEL: Record<ProductKey, string> = {
  profile: "Profile",
  customers: "Customers",
  visits: "Visits",
  orders: "Orders",
  reservations: "Reservations",
  rewards: "Rewards",
  // "Payments" is the label; `pay` stays the KEY, because the address, the tab
  // and the column are persisted spellings.
  pay: "Payments",
  credits: "Credits",
  capital: "Capital",
};
