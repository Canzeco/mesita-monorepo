// THE LONG FORM — what each product is, for the catalogue (MESITA-1999).
//
// Pato: *"SHOW CURRENT AND FUTURE PRODUCTS, WITH GREAT EXPLAINATIONS"*.
//
// WHY THIS IS NOT `blurb`. A card's blurb is ONE sentence and has to stay one
// sentence — `web-business` pins that shape in `products.test.ts`, and it is
// the right shape for a row in a grid an operator is scanning. The catalogue
// is the opposite surface: it is read once, slowly, by somebody deciding
// whether they want any of this. Widening `blurb` to serve both would make
// every card in the index carry a paragraph it does not have room for.
//
// WHAT A GOOD ENTRY DOES, and the three ways these used to fail:
//
//   1. It says what the venue GETS, not what Mesita does. "Accept card
//      payments" is a feature list; "settled into your own Stripe account,
//      Mesita never holds the money" is the thing an owner actually wants to
//      know.
//   2. It names the ONE fact that separates this product from its neighbour.
//      Orders are prepaid. Credits can only be spent here. A visit settles
//      the same whether the guest paid cash or card. Without that fact,
//      Orders and Table Orders are the same paragraph twice.
//   3. It never promises what is not built. Every unbuilt product's entry
//      describes the SHAPE of the thing, in the same plain voice, and the
//      box's own state word is what says it is not here yet — so the copy
//      does not have to hedge in every sentence and does not have to lie in
//      any of them.
//
// Written from the venue's side and in its language: "guests", "the bill",
// "the till", "the counter". Never "users", never "merchants".
import type { ProductKey } from "@/lib/product-keys";

export const PRODUCT_CATALOG_COPY: Record<ProductKey, string> = {
  profile:
    "Your page on Mesita — the photos, the hours, the address and what you are known for. It exists whether or not you claim the place, because Mesita builds one from what is already public; claiming it is how you decide what it says. This is what a guest reads in the seconds before they pick somewhere to eat.",

  partner:
    "The badge beside your name on the map, and the rung that grants it. It is not something you buy on its own — Mesita Ultra carries it — and what it buys is trust: a guest scrolling a list of places sees which of them Mesita stands behind. Verified says the place is real. Partner says it is here on purpose.",

  reviews:
    "Everything the world says back about you, counted in one place: your Google stars and how many, what Mesita's own guests scored you on food, service, ambience and value, and what is being said on Instagram and Facebook. Nothing here is yours to write, which is exactly why it is worth a screen of its own — it is the only page in this console you cannot edit your way out of.",

  menu:
    "Your menu as data rather than a PDF: dishes, prices, and what has run out tonight. Upload the file you already have and Mesita turns it into the list. It is the one thing three other products read — guests browse it, Online Orders sells from it, and the Answering Agent quotes it on the phone — so it is worth getting right once.",

  website:
    "A real website for the place, built from the profile and the menu you have already filled in here. Your own address, nothing to maintain, and it updates itself when the menu does. For the venues whose website today is a link in an Instagram bio.",

  visits:
    "A discount at the bill, or cashback for the next visit, for guests who came through Mesita. The rates are Mesita's; you switch on what earns them — a first visit, an Instagram story, a Mesita review — and set the most a visit may cost. The money only leaves on a visit you might not otherwise have had, which is the whole trade.",

  orders:
    "Pickup, ordered and paid for before the guest arrives, from six channels into one queue: the Mesita app, your website, WhatsApp, Uber Eats, Rappi and DiDi. Prepaid is the difference that matters — a no-show costs you nothing, and the ticket reaches the kitchen with the money already collected. Delivery is coming: your own couriers by WhatsApp, or Uber Direct.",

  tableorders:
    "The guest at table six scans the QR and orders from their own phone. The same prepaid rail as Online Orders, without the walk to the counter and without holding up a waiter to read a menu out loud.",

  reservations:
    "Bookings from the Mesita app and from your own profile, held against the tables you actually have. Confirmations, changes and cancellations reach you without the phone ringing.",

  pay: "Card payments for visits and orders, settled straight into your own Stripe account. Mesita never holds your money — it moves from the guest to you, and the discount, the tip and the credits are already worked out by the time the charge goes through.",

  terminal:
    "Mesita's own card reader for the counter. A Mesita visit settles on Mesita hardware, so the discount and any prepaid balance apply without anybody retyping a total or reading a code off a phone.",

  pos: "The full point of sale — tables, courses, staff, the close of day. It is the furthest out of anything here, and it is on the list because a venue that runs its floor on Mesita should not also be running a second till beside it.",

  orderpad:
    "A handheld for the floor. The waiter takes the order at the table and it reaches the kitchen on the way back, instead of on a pad that gets typed in later.",

  credits:
    "Cash now for meals later. You open a campaign — pay $800, get $1,000, until a date, up to a cap — and guests buy a balance they spend across later visits. The branch that sold it keeps the cash and owes the meals, forever; a sister branch in your organisation can choose to honour those credits too, and settle with you.",

  capital:
    "Cash up front against food you will serve later. It is an advance sale, never a loan: you settle it in meals rather than in interest, and nothing is secured against the business.",

  line:
    "It answers your number — a call or a WhatsApp — for anyone, whether or not they have Mesita. It takes the booking, takes the pickup order and sends the Stripe link before the kitchen starts, answers the hours and the menu, and hands a person anything it cannot. What it learned from that person, it remembers for the next call.",

  customers:
    "Who your guests actually are — how often each one comes back, what they spend, and which ones have stopped. It is rented rather than bought per name, because a contact you paid for once quietly stops being true.",

  ads: "Campaigns on Facebook, Instagram and Google, run from here against the profile and menu Mesita already holds. One budget, one screen that says what it bought, and no exporting your own photos into three ad managers.",

  access:
    "An API key and an MCP connector. Your own systems can read and write everything this console does, and so can an AI assistant you already use — which is the point of the connector rather than only the key.",

  intelligence:
    "Reads what your other products recorded and tells you what actually worked: which discount paid for itself, which channel brought the guests, which nights are worth staffing harder.",
};
