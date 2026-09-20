// THE PRODUCT VOCABULARY — the twenty keys, and nothing else.
//
// Snapshot of `apps/web-business/src/lib/product-keys.ts`. Kept free of
// imports for the same reason the original is: `PLACE_TAB_LABEL` names
// products and the rail is the one column every page renders, so learning what
// a product is CALLED must not drag the catalogue grid into every bundle.
//
// THE ORDER IS PATO'S (2026-09-16), and it is the whole list he dictated, in
// his sequence:
//
//   Profile · Partner · Reviews · Menu · Website ·   what the world sees
//     Customers · Ads
//   Visits · Orders · Table Orders · Reservations     the guest, being served
//   Payments · Terminal · POS · Orderpad ·            the money
//     Credits · Capital
//   Answering Agent · Developers · Intelligence       the work nobody is doing
//
// TWENTY SINCE MESITA-2011 — Pato's own two lists of ten, Actuales and
// Futuros. The split between them is not here: it is `PRODUCT_ORDER` in
// `product-routes.ts`, which names the ten with a menu row, and everything
// left over is what the Future products door opens.
//
// THE BANDS ARE A RENDER NOW (MESITA-1962). Pato: *"divide in sections"*.
// They were a comment for two days, while this file said the order is
// otherwise unexplainable — Terminal sits between Payments and Credits for a
// reason, and a later sort that does not know the reason will "fix" it. The
// catalogue draws them as headed groups, so the reason is on the screen
// instead of load-bearing and invisible. See `PRODUCT_BANDS` below.
export const PRODUCT_KEYS = [
  "profile",
  // PARTNER IS A PRODUCT NOW (MESITA-2011). Pato, 2026-09-19: *"casi que
  // partner lo quiero meter como un producto… que sea casi un producto"*, and
  // then, dictating the catalogue: *"1. Mesita Profile 2. Mesita Partner"*.
  //
  // IT REVERSES `PartnerCard`'s OWN RULING, which is written out at the top of
  // that file: a subscription cannot answer the grid's question, because "On
  // because you bought it" and "On because somebody flipped a switch" are
  // different facts with one word between them.
  //
  // WHAT MAKES IT SURVIVE NOW is that this card is not the subscription. It is
  // the BADGE — a fact about the place that the world can see, exactly like
  // Verified — and the badge answers the grid's question honestly: it is on or
  // it is not. The rung that granted it is the note.
  //
  // AND IT IS ONLY THAT (MESITA-2012). MESITA-2011 pointed this key at the
  // pane the Plan row used to open, which put a price grid behind a card
  // badged `On` and quietly made the row a replacement for Plan rather than a
  // peer of it. Pato: *"this goes into plan, not mesita partner, different
  // things."* `PartnerPane` is the badge; `/places/<id>/plan` is the
  // purchase; the Plan row is back beside Place and Settings.
  "partner",
  // REPUTATION IS ITS OWN ROW AGAIN (MESITA-2011), which reverses MESITA-2007,
  // which reversed MESITA-1993. Third position on Pato's own list.
  //
  // WHAT 2007 GOT RIGHT AND WHY IT STILL LOSES: Profile is what an operator
  // SETS and reputation is what the world says back, so Setup / Activity looks
  // like the container the split always wanted. It is the right shape for one
  // SUBJECT with two faces — and Pato is telling us these are two subjects.
  // Your page is one product; what Google, Instagram and Mesita say about you
  // is another, and only the second one has four sources to name.
  //
  // THE COST OF THE FLIP IS ONE LINE EACH in `PRODUCT_HALVES` and
  // `PRODUCT_VIEW`: `ReviewsView` never left the tree, because 2007 mounted it
  // as Profile's Activity half rather than deleting it.
  "reviews",
  // THE FIFTEENTH, AND IT WAS ALREADY HALF HERE (MESITA-1966). Pato: *"Add
  // digital menu as one item"*.
  //
  // A PLACE HAS MENUS TODAY AND THEY ARE FILES. `MenusSection` on Profile
  // takes a name plus one source — an upload or a Drive link, up to twenty —
  // and that is a thing a guest DOWNLOADS. Nothing in it prices a dish,
  // nothing hands Online Orders its items, and Answering Agent's own blurb
  // already promises it answers a call with "the menu" it has no way to read.
  // So the menu stops being a card inside another product and becomes one.
  //
  // IT SITS DIRECTLY AFTER `profile`, above `website`, because the three are
  // the same subject at three depths: who you are, what you serve, and the
  // site that renders both.
  "menu",
  // THE SEVEN NEW ONES (MESITA-1946) are `website`, `ads`, `terminal`, `pos`,
  // `whatsapp`, `phone` and `intelligence`. NOT ONE OF THEM IS BUILT — no
  // table, no migration, no Edge Function — so every one ships Soon, the same
  // shape Customers and Capital already ship in. Pato wrote "(Soon)" beside
  // three of them and *"but for the future"* beside POS; the rest do not exist
  // either, and a catalogue card is a claim about what the console READ.
  "website",
  "customers",
  "ads",
  // ONE PRODUCT, NOT TWO (MESITA-1953). Pato: *"FOR THE MOMENT I WILL MERGE
  // VISIT & REWARDS"*. This is the third time the answer has moved —
  // MESITA-1884 folded Rewards in on *"should i separate visits and rewards
  // into two?? i don't think so"*, MESITA-1928 split it back out — and 1928's
  // argument was about WHERE Rewards sits, not that it owed a second card: a
  // reward is earned by closing a bill AT A TABLE and by nothing else, which
  // is an argument for putting it beside Visits, and one step further is
  // putting it INSIDE.
  //
  // THE KEY STAYS `visits`, on the `pay` precedent above: it is the tab, the
  // address and the fixture spelling. `rewards` leaves the CATALOGUE, keeps
  // its VIEW — the strategy dial must stay settable in exactly one place, or
  // two screens disagree about which dial is live (see `VisitsView`).
  "visits",
  "orders",
  "tableorders",
  "reservations",
  // "Payments" is the label; `pay` stays the KEY, because the address, the tab
  // and the column are persisted spellings.
  "pay",
  "terminal",
  // THE READER AND THE TILL ARE A PAIR, so `pos` sits next to `terminal`
  // rather than at the end of the list Pato dictated it after.
  "pos",
  "orderpad",
  "credits",
  "capital",
  // ONE PRODUCT, NOT TWO (MESITA-1951). Pato: *"Mesita AI Line instead"*,
  // arriving over `whatsapp` and `phone` at once. A venue has ONE number and
  // in Mexico that number is its WhatsApp, so two cards priced the same thing
  // twice and left an operator asking which one they were buying. A LINE is
  // the subject both channels share.
  //
  // The KEY is `line` and the name is what you buy, on `pay`'s precedent: the
  // channel does not belong in the key, because the channel is the part that
  // will grow.
  "line",
  "access",
  "intelligence",
] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

/** ONE PRODUCT, ONE NAME (MESITA-1963) — the string the rail row, the view
 *  heading and the catalogue card all use, identically, with no derivation
 *  between them.
 *
 *  IT USED TO BE "THE CARD'S NAME MINUS THE BRAND", on MESITA-1956's argument
 *  that a view inside a place is not being compared to its neighbours because
 *  you are already there. THAT ARGUMENT DIED with this rail: six products now
 *  stack in one column, so the rail IS comparing them, and "Orders" above
 *  "Payments" above "Credits" says nothing about which is which.
 *
 *  AND HAND-KEPT SYNC HAD ALREADY FAILED, which is the better reason. Three
 *  entries here were stale when this issue opened — `pos` said "Point of Sale"
 *  after MESITA-1958 made the card Physical POS, `line` said "Host" after
 *  MESITA-1960 made it Answering Agent, and `intelligence` said "Market
 *  Intelligence" after the card became Marketing Intelligence. Nothing caught
 *  it: no gate compares this map to `lib/products.ts`, and the mock has no
 *  tests. A rename that must be typed in two files eventually is typed in one.
 *
 *  SO A RENAME LANDS HERE AND IN `lib/products.ts`, and the two must match
 *  exactly. `PLACE_TAB_LABEL` reads through this map, so the view headings
 *  follow for free; `rewards` and `admin` keep their own literals over there
 *  because neither is a product in the catalogue. */
export const PRODUCT_LABEL: Record<ProductKey, string> = {
  profile: "Mesita Profile",
  partner: "Mesita Partner",
  reviews: "Online Reviews",
  menu: "Digital Menu",
  website: "Express Website",
  customers: "Customer Intelligence",
  ads: "Omnichannel Ads",
  visits: "Visit Rewards",
  orders: "Online Orders",
  tableorders: "Table Orders",
  reservations: "Online Reservations",
  pay: "Online Payments",
  terminal: "Physical Terminal",
  pos: "Physical POS",
  orderpad: "Physical Orderpad",
  credits: "Prepaid Credits",
  capital: "Mesita Capital",
  line: "Answering Agent",
  access: "Developers Platform",
  intelligence: "Marketing Intelligence",
};

/** THE FOUR BANDS, AS DATA. What the catalogue heads each group with, in
 *  `PRODUCT_KEYS` order — the members of each band are CONTIGUOUS there, which
 *  is why drawing them moves no card and why each list below is a slice rather
 *  than a re-sort. 7 + 4 + 6 + 3 = 20.
 *
 *  THE NAMES ARE PATO'S OWN, from the list he dictated: they say what a band is
 *  FOR rather than what its members share technically, which is the only way a
 *  header earns its line. "The work nobody is doing" is the pitch for both
 *  products under it.
 *
 *  A KEY IN NO BAND IS A COMPILE ERROR, not a card that quietly falls off the
 *  page: `BANDED_KEYS` is typed as the full `ProductKey` union, so adding a
 *  twenty-first product without placing it fails `tsc`. */
export const PRODUCT_BANDS: readonly {
  title: string;
  keys: readonly ProductKey[];
}[] = [
  {
    // MESITA PARTNER AND ONLINE REVIEWS JOIN THIS BAND (MESITA-2011), and the
    // heading is why they belong together: the badge and the stars are both
    // things a GUEST reads about this place before they walk in. Partner could
    // as easily have gone under "The money" — it is granted by a rung and
    // nothing else — but what the card states is the badge, not the invoice,
    // and the invoice has no band here at all.
    title: "What the world sees",
    keys: ["profile", "partner", "reviews", "menu", "website", "customers", "ads"],
  },
  {
    title: "Serving the guest",
    keys: ["visits", "orders", "tableorders", "reservations"],
  },
  {
    title: "The money",
    keys: ["pay", "terminal", "pos", "orderpad", "credits", "capital"],
  },
  {
    // RENAMED WITH ITS CONTENTS (MESITA-1978). It was "The work nobody is
    // doing", which was true of both rows when both were Soon. Answering Agent
    // is live on Pato's newest list and Omnichannel Access arrives live beside
    // it, so the title described one row of three. A band titled for a STATE
    // goes stale every time a product ships; this one is titled for what the
    // products DO, which is the only thing about them that does not move.
    title: "Answering for you",
    keys: ["line", "access", "intelligence"],
  },
];

/** EVERY BANDED KEY, FLAT — the exhaustiveness check. Typed as `ProductKey`,
 *  so a key that exists and is unplaced makes this union incomplete and `tsc`
 *  refuses the file. It is not a runtime list anybody reads. */
const BANDED_KEYS: { [K in ProductKey]: true } = {
  profile: true,
  partner: true,
  reviews: true,
  menu: true,
  website: true,
  customers: true,
  ads: true,
  visits: true,
  orders: true,
  tableorders: true,
  reservations: true,
  pay: true,
  terminal: true,
  pos: true,
  orderpad: true,
  credits: true,
  capital: true,
  line: true,
  access: true,
  intelligence: true,
};
void BANDED_KEYS;
