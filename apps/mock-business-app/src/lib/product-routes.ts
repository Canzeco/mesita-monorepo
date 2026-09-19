// THE PRODUCT ADDRESSES — one slug, two surfaces (MESITA-1986).
//
// Pato: *"create all these routes and subroutes — setup/mesita-profile,
// setup/digital-menu, setup/visit-rewards… activity/mesita-profile,
// activity/digital-menu, activity/visit-rewards… I MEAN, A SYMMETRY MUST
// EXIST."*
//
//   /places/<id>/products/<slug>    how this product is configured
//   /places/<id>/activity/<slug>    what this product recorded
//
// ONE SLUG SERVES BOTH, which is the whole point: the two sides cannot drift
// because there is nothing to keep in step. A product added to `PRODUCT_KEYS`
// gets an address on both surfaces the moment it gets a slug here, and this
// record is exhaustive over the union, so the compiler refuses a product that
// has none.
//
// THE SLUG IS THE NAME, NOT THE KEY. `visits` is a persisted spelling from
// before Visit Rewards was called that, and `pay` is three letters chosen for a
// column: neither is what an operator would type. A person reading
// `/setup/visit-rewards` in a URL bar knows where they are, and that is the
// only job a slug has. The keys stay exactly where they are — this maps.
//
// `?p=` IS RETIRED. A query parameter cannot be symmetrical across two
// surfaces without repeating itself, and it is not what somebody types.
import { PRODUCT_KEYS, type ProductKey } from "@/lib/product-keys";

/** Mesita Partnership's slug. It is not a `ProductKey` — see the sentinel in
 *  the Setup page — but it IS a row in the list and needs an address like every
 *  other row. */
export const PARTNERSHIP_SLUG = "mesita-partnership";

export const PRODUCT_SLUG: Record<ProductKey, string> = {
  profile: "mesita-profile",
  menu: "digital-menu",
  website: "express-website",
  customers: "customer-intelligence",
  ads: "omnichannel-ads",
  visits: "visit-rewards",
  orders: "online-orders",
  tableorders: "table-orders",
  reservations: "online-reservations",
  pay: "online-payments",
  terminal: "physical-terminal",
  pos: "physical-pos",
  orderpad: "physical-orderpad",
  credits: "prepaid-credits",
  capital: "mesita-capital",
  line: "answering-agent",
  access: "developers-platform",
  intelligence: "marketing-intelligence",
};

/** The reverse, built once. A slug that is not a product returns null and the
 *  route 404s on purpose: a typo must never render a generic page. */
const BY_SLUG: Record<string, ProductKey> = Object.fromEntries(
  PRODUCT_KEYS.map((k) => [PRODUCT_SLUG[k], k]),
);

export function productFromSlug(slug: string): ProductKey | null {
  return BY_SLUG[slug] ?? null;
}

/** Which of the two surfaces a pane is drawn on. The views read it through
 *  `Half`, so a product's setup and its log are ONE component with two
 *  readings rather than two components that can disagree about a number. */
export type PlaceHalf = "products" | "activity";

export function productHref(
  placeId: string,
  half: PlaceHalf,
  slug: string,
): string {
  return `/places/${encodeURIComponent(placeId)}/${half}/${slug}`;
}

export function productKeyHref(
  placeId: string,
  half: PlaceHalf,
  key: ProductKey,
): string {
  return productHref(placeId, half, PRODUCT_SLUG[key]);
}
