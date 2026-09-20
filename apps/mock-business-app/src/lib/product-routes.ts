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

/** THE PLAN SENTINEL IS GONE (MESITA-2011). It was `PARTNERSHIP_SLUG =
 *  "plan"` — a row in the list that was deliberately not a `ProductKey`, so
 *  both `[product]` pages had to answer it before `productFromSlug` and the
 *  sidebar had to draw it as its own kind.
 *
 *  Partner is a product now, so the address is `PRODUCT_SLUG.partner` and the
 *  two sentinel branches are deleted. `mesita-partner` over `plan`: the slug
 *  is the NAME, which is the rule this file already runs on, and Pato's list
 *  calls the row Mesita Partner. Nothing outside this app links to either. */

/** THE MENU'S PRODUCTS, in Pato's order (MESITA-1997, 2026-09-19) — *"i only
 *  want 10 things for the moment"*, and eleven since MESITA-2013 put Express
 *  Website back.
 *
 *  The index is this list and nothing else. It replaces a RUNNING/COMING
 *  split that sorted by `state`, which meant the order of the console's own
 *  product list was decided by whether each one happened to be built yet —
 *  Pato: *"i don't want a coming then shit."*
 *
 *  EXPRESS WEBSITE IS IN IT AND IS NOT BUILT, and that is the point: a
 *  product earns its row by mattering, and its row still says Soon. The two
 *  facts are independent now, which they were not while the groups existed. */
// EXPRESS WEBSITE GOES LAST (MESITA-2004). Pato's own list, 2026-09-19, ends
// *"8. Answering Agent 9. Express Website"* — a move from 3rd, and the rule it
// implies is worth writing down because the next row move will need it:
//
//   EVERYTHING YOU CAN USE, THEN EVERYTHING YOU CANNOT.
//
// It is NOT a state sort. `line` is Locked and sits above `website`, which is
// Soon, because Locked is a product that EXISTS behind a rung — you can read
// what it does and go buy it — and Soon is a product that does not exist at
// all. Only the second one has nothing whatever to look at, so only the second
// one goes to the bottom.
// IT WENT TO TEN, AND IT IS ELEVEN AGAIN (MESITA-2013). MESITA-2011 made this
// Pato's "Actuales" list exactly — Partner 2nd, Online Reviews 3rd, and
// EXPRESS WEBSITE GONE, because he had put it in Futuros in the same breath.
// On 2026-09-20, looking at the sidebar that produced: *"add express website
// product here into sidebar menu"*. So the row comes back, and with it the
// rule two paragraphs up, which MESITA-2011 had retired for want of anything
// Soon to apply it to:
//
//   EVERYTHING YOU CAN USE, THEN EVERYTHING YOU CANNOT.
//
// `website` is last, under `line`, on exactly the reading written above — the
// Answering Agent is Locked, which is a product you can read about and go buy;
// Express Website is Soon, which is a product that does not exist at all. It
// is also where Pato's own numbering put the pair the last time he ordered
// them: *"8. Answering Agent 9. Express Website"*.
//
// THIS SETTLES THE SECOND LIST MESITA-2011 SET ASIDE. That one pulled Express
// Website back to 9th against his own Futuros placement, and the decision then
// was that the Actuales/Futuros pair wins and a row move is one line here if
// he meant the other. He meant the other. This is that line.
//
// FUTUROS AND THE CATALOGUE STILL DISAGREE, ON PURPOSE. A row here is about
// whether a product MATTERS; `state` is about whether it is BUILT. Express
// Website is a menu row and a Coming box at the same time, and `FuturePane`
// already names its own axis rather than inheriting this one.
export const PRODUCT_ORDER = [
  "profile",
  "partner",
  "reviews",
  "menu",
  "visits",
  "orders",
  "reservations",
  "pay",
  "credits",
  "line",
  "website",
] as const satisfies readonly ProductKey[];

/** Everything the list above leaves out, behind ONE row. Not a product and
 *  not a `ProductKey` — the same sentinel shape `PARTNERSHIP_SLUG` is. */
export const FUTURE_SLUG = "future-products";

export const PRODUCT_SLUG: Record<ProductKey, string> = {
  profile: "mesita-profile",
  partner: "mesita-partner",
  reviews: "online-reviews",
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
