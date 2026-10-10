// THE PRODUCT VOCABULARY — the fifteen keys, and nothing else (MESITA-1885).
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
// THE ORDER IS PATO'S (2026-09-16), and the list is the whole suite he
// dictated — *"Put all this shit into the suite"*, then *"maybe include POS,
// but for the future"*:
//
//   Profile · Website · Customers · Ads               what the world sees
//   Visits · Rewards · Orders · Reservations          the guest, being served
//   Payments · Terminal · POS · Credits · Capital     the money
//   WhatsApp Bot · Phone Bot · Intelligence           the work nobody is doing
//
// THOSE FOUR BANDS ARE A READING, NOT A RENDER. His earlier list came with
// explicit separators and this one came as flat lines, so the catalogue draws
// one flat grid in this order and nothing else. They are written down because
// the order is otherwise unexplainable — Terminal and POS sit between Payments
// and Credits for a reason, and a later sort that does not know the reason
// will "fix" it.
//
// ── THE RAIL NO LONGER PRINTS THIS LIST, AND THAT IS THE POINT (MESITA-1949)
//
// It used to, exactly: `products.test.ts` asserted `RAIL_ROWS`' products
// equalled `PRODUCT_ORDER` element for element, because MESITA-1928 had moved
// Rewards in one and not the other and for a commit the console answered
// "where does Rewards belong" two different ways.
//
// Most of these are catalogue-only. Giving each a rail row would give
// each an ADDRESS, and MESITA-1900 deleted Terminal for precisely that — "it
// was the one row whose address was a SoonStrip" — while MESITA-1833's law is
// that a row lands somewhere real. So the rail keeps its nine rows, the
// catalogue names every product, and the assertion is a SUBSEQUENCE now: every
// rail product is a real product in catalogue order, and the catalogue may
// name products the rail does not.
//
// ── TWO CHANGES FROM THE 2026-09-15 EIGHT (MESITA-1900) ───────────────────
//
// TERMINAL LEFT, AND MESITA-1949 BRINGS IT BACK — on Pato's list, and still
// `soon` for the same reason it went: there is no hardware. What does NOT
// come back is the rail row and `products/terminal`: it is a card now, which
// is the shape MESITA-1900's objection was actually about.
//
// REWARDS CAME BACK, AND IT CAME BACK IN THE MONEY GROUP. MESITA-1884 folded
// the Rewards card into Visits on Pato's *"should i separate visits and
// rewards into two?? i don't think so."* This list separates them, and
// MESITA-1928 moved it back to the table: a reward is earned by closing a bill
// AT A TABLE and by nothing else, since an order is prepaid and has none.
export const PRODUCT_KEYS = [
  "profile",
  // THE SEVEN NEW ONES (MESITA-1949) are `website`, `ads`, `terminal`, `pos`,
  // `whatsapp`, `phone` and `intelligence`. NOT ONE OF THEM IS BUILT — no
  // table, no migration, no Edge Function — so every one ships Soon, the shape
  // Customers and Capital already ship in. Pato wrote "(Soon)" beside three of
  // them and *"but for the future"* beside POS; the rest do not exist either,
  // and a catalogue card is a claim about what the server READ.
  "website",
  "customers",
  "ads",
  // ONE PRODUCT, NOT TWO (MESITA-2035) — the collapse MESITA-1953 shipped in
  // the mock and named as this console's follow-on, never filed until now.
  // MESITA-1971 settled the argument: can a place buy either half alone and
  // be glad it did? Rewards alone is impossible (a reward is earned by
  // closing a bill at a table and by nothing else) and checkout alone is a
  // free QR that competes with the paper check. One card with a dial.
  //
  // THE KEY STAYS `visits` and `rewards` KEEPS ITS VIEW. It leaves the
  // CATALOGUE only: `PLACE_TABS.rewards`, `FLAT_ROUTES.rewards` and
  // `/places/<id>/rewards` are untouched, because one product's state must be
  // settable in exactly one place or two screens disagree about which dial is
  // live. `VisitsView` carries the door, since the card was the only way in.
  "visits",
  "orders",
  "reservations",
  "pay",
  "terminal",
  // THE READER AND THE TILL ARE A PAIR, so `pos` sits beside `terminal`
  // rather than at the end of the list Pato dictated it after.
  "pos",
  "credits",
  // Pato, on the catalogue (MESITA-1929): "where is Capital, include Capital
  // there". It lived only on the marketing site until then.
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

/** What the rail calls each product: THE CARD'S NAME MINUS THE BRAND.
 *
 *  THE PREFIX IS NOT DECORATION ANY MORE (MESITA-1955). Pato's list renamed
 *  the suite to say what a place GETS — Online Orders, Physical Terminal,
 *  Prepaid Credits — and left "Mesita" on exactly three: Profile, Capital and
 *  Host, the three where MESITA IS THE COUNTERPARTY. The page lives on Mesita,
 *  the money advanced is Mesita's, and the voice answering the phone is
 *  Mesita's. Everywhere else the brand was the only word the cards had in
 *  common, which made a column of one word and said nothing about any of them.
 *
 *  So the rail drops only that prefix, never the descriptor: Profile, Capital,
 *  Host — but Online Orders stays Online Orders, because "Orders" is the half
 *  of the name that does not say which orders. One product, one noun, in both
 *  places it is read. */
export const PRODUCT_LABEL: Record<ProductKey, string> = {
  profile: "Profile",
  website: "Website",
  customers: "Guest Catalog",
  ads: "Omnichannel Ads",
  // MEMBER VISITS (MESITA-2035). Pato: *"rename Visit Rewards to Member
  // Visits in both consoles"*. The sixth label on a key that has been spelled
  // `visits` throughout, and the first one that agrees with it. "Member" is
  // free because "Membership" died at MESITA-2019 — there is no Membership to
  // have or not have, there are three rungs.
  //
  // `rewards` HAS NO ENTRY HERE ANY MORE: it is not a product in the
  // catalogue, so its view label is a literal in `place-tabs.ts`, the shape
  // `admin` already had. The DIAL is not renamed — that switch turns the
  // giving back on, and a place whose rewards are off still takes member
  // visits, so calling it "Member Visits" would state a fact that is untrue.
  visits: "Member Visits",
  orders: "Online Orders",
  reservations: "Reservations",
  // "Online Payments", AND THE CARD SAYS THE SAME (MESITA-1955). MESITA-1884
  // was titled "Pay becomes Payments" and shipped "Pay", because the card said
  // Mesita Pay and one product wearing two nouns in one console is worse than
  // either noun — *"rename both together or neither."* That rule is why this
  // label and `SPECS` in lib/products.ts have never moved apart, and why the
  // breadcrumb, the two loading labels, the switch's aria-label and the
  // ladder's fix label moved in this commit too. ONLINE is the word that does
  // the work now: it is the half a guest pays from their phone, which is what
  // makes Physical Terminal a different product rather than the same one with
  // hardware.
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
  // Everything an operator reads as THE PRODUCT says Online Payments: this
  // label, the rail row, the catalogue card, the view heading, the breadcrumb,
  // the ladder rung and the setup page.
  pay: "Online Payments",
  terminal: "Digital Terminal",
  pos: "Point of Sale",
  credits: "Prepaid Credits",
  capital: "Capital",
  line: "Host",
  intelligence: "Market Intelligence",
};
