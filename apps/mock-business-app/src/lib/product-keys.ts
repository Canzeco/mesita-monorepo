// THE PRODUCT VOCABULARY — the fifteen keys, and nothing else.
//
// Snapshot of `apps/web-business/src/lib/product-keys.ts`. Kept free of
// imports for the same reason the original is: `PLACE_TAB_LABEL` names
// products and the rail is the one column every page renders, so learning what
// a product is CALLED must not drag the catalogue grid into every bundle.
//
// THE ORDER IS PATO'S (2026-09-16), and it is the whole list he dictated, in
// his sequence:
//
//   Profile · Website · Customers · Ads               what the world sees
//   Visits · Rewards · Orders · Reservations          the guest, being served
//   Payments · Terminal · POS · Credits · Capital     the money
//   AI Line · Intelligence                            the work nobody is doing
//
// THOSE FOUR BANDS ARE A READING, NOT A RENDER. His earlier list came with
// explicit separators (*"Profile · Costumers // Visits · Orders ·
// Reservations // ..."*) and this one came as flat lines, so the
// catalogue draws one flat grid in this order and nothing else. The bands are
// written down here because the order is otherwise unexplainable — Terminal
// sits between Payments and Credits for a reason, and a later sort that does
// not know the reason will "fix" it.
export const PRODUCT_KEYS = [
  "profile",
  // THE SEVEN NEW ONES (MESITA-1946) are `website`, `ads`, `terminal`, `pos`,
  // `whatsapp`, `phone` and `intelligence`. NOT ONE OF THEM IS BUILT — no
  // table, no migration, no Edge Function — so every one ships Soon, the same
  // shape Customers and Capital already ship in. Pato wrote "(Soon)" beside
  // three of them and *"but for the future"* beside POS; the rest do not exist
  // either, and a catalogue card is a claim about what the console READ.
  "website",
  "customers",
  "ads",
  "visits",
  "rewards",
  "orders",
  "reservations",
  // "Payments" is the label; `pay` stays the KEY, because the address, the tab
  // and the column are persisted spellings.
  "pay",
  "terminal",
  // THE READER AND THE TILL ARE A PAIR, so `pos` sits next to `terminal`
  // rather than at the end of the list Pato dictated it after.
  "pos",
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
  "intelligence",
] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

/** What the rail and the catalogue call each product. The rail says the noun
 *  alone; the grid says "Mesita <noun>", where the cards are being compared to
 *  each other and the brand is the point. */
export const PRODUCT_LABEL: Record<ProductKey, string> = {
  profile: "Profile",
  website: "Website",
  customers: "Customers",
  ads: "Ads",
  visits: "Visits",
  rewards: "Rewards",
  orders: "Orders",
  reservations: "Reservations",
  pay: "Payments",
  terminal: "Terminal",
  pos: "POS",
  credits: "Credits",
  capital: "Capital",
  line: "AI Line",
  intelligence: "Intelligence",
};
