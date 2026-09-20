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
 *  two sentinel branches are deleted. The slug is the NAME, which is the rule
 *  this file runs on — so it moved with the name to `partner-badge` when Pato
 *  renamed the row (MESITA-2021), on the `access` precedent: the KEY is a
 *  persisted spelling, the slug is what a person types. Nothing outside this
 *  app links to `mesita-partner` or to the `plan` sentinel it replaced. */

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
// AND NOW IT IS ELEVEN (MESITA-2017). MESITA-2011 made it Pato's ten
// Actuales and wrote down that his second list — the one with Express Website
// at 9th and no Digital Menu — "reads as the old sidebar recited". On
// 2026-09-20 he answered the question directly, at the /autoplan gate: Digital
// Menu stays at 4th (three products read the published menu) AND Express
// Website comes back off the Futuros door, tenth, ahead of the Agent. So this
// is neither of the two lists he dictated; it is the one he approved with the
// contradiction pointed out to him.
//
// EXPRESS WEBSITE IS IN IT AND IS NOT BUILT, again, which revives the rule
// MESITA-2004 wrote and MESITA-2011 retired: a product earns its row by
// mattering, and `products.ts` decides separately whether its card says Soon.
// It does not say Soon any more — but only because the mock now carries the
// picker → preview → published states as fixtures (`websiteState`), which is
// the exact condition `products.ts`'s header sets for a live chip.
//
// A LITERAL, PINNED BY TEST. `product-order.test.ts` asserts this array equals
// the dictated eleven, element for element. `satisfies` already refuses a key
// outside `PRODUCT_KEYS`; the test is what refuses a row MOVE nobody decided.
//
// MESITA-2013 HAD ALREADY PUT IT BACK, LAST, on the everything-you-can-use
// rule (Locked above Soon). Pato's dictation at the gate puts it TENTH, ahead
// of the Agent, and the rule no longer bites: the Website is not Soon any
// more, so there is nothing to sort to the bottom.
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
  "website",
  "line",
] as const satisfies readonly ProductKey[];

/** Everything the eleven leaves out, behind ONE row. Not a product and not a
 *  `ProductKey` — the same sentinel shape `PARTNERSHIP_SLUG` was. */
export const FUTURE_SLUG = "future-products";

export const PRODUCT_SLUG: Record<ProductKey, string> = {
  profile: "mesita-profile",
  partner: "partner-badge",
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
