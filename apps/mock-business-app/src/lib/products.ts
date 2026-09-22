// What a product's STATE is — pure, and the catalogue's only source of truth.
//
// Leads `apps/web-business/src/lib/products.ts` (see the last paragraph of
// this header). A card states a fact the
// console READ: a product above this place's rung reads Locked and carries NO
// verb, a per-place product prints whether it is on HERE, and an unbuilt one
// is Soon.
//
// ── THE GATE IS A RUNG, NOT A BOOLEAN (MESITA-1997) ────────────────────────
//
// There is no Membership to have or not have; there are THREE rungs since
// MESITA-2019 — Free, Mesita Pro, Mesita Ultra — and a product names the
// LOWEST one that carries it. `planAtLeast` is the whole check.
//
// `needsPartner: boolean` could not express this: two states cannot gate
// three rungs, and the Answering Agent is the proof — it was ungated, it is
// Ultra's, and there was no way to say so.
//
// THE THREE RUNGS AS A TABLE, so `minPlan` is a lookup and not a judgment
// made once per product:
//
//   free   Mesita Profile, Online Reputation, Digital Menu
//          — the LISTING, and it is now the whole listing: who you are, what
//          the world says back, and what you serve. Nothing here costs Mesita
//          a peso per place.
//   pro    Express Website, Online Orders, Online Reservations, Online
//          Payments — the selling surface: where a guest reads the menu that
//          Free already gave them, and the rail that charges them.
//   ultra  Partner Badge, Member Visits, Prepaid Credits, Answering Agent,
//          Developers Platform, Table Orders, Customer Intelligence,
//          Marketing Intelligence — what brings a guest BACK, plus anything
//          that costs us per use (model minutes, compute, API bandwidth).
//
// PATO DICTATES THIS TABLE, and he has dictated it twice in one day.
// MESITA-2021 (2026-09-20) read it back unchanged; MESITA-2025, four hours
// later, moved DIGITAL MENU down to Free and renamed Online Reviews.
//
// WHY THE MENU IS FREE. It was the cheapest thing on the selling surface, and
// it is the one product three others READ — guests browse it, Online Orders
// sells from it, the Answering Agent quotes it. A rung that withholds the menu
// withholds the INPUT to everything above it, so a place that never uploaded
// one arrived at Mesita Pro with nothing to sell. Free asks for the menu while
// it costs nothing; Pro sells it.
//
// `product-rungs.test.ts` pins the lists, so the next `minPlan` that moves has
// to move his list with it.
//
// ORDERS CANNOT SIT BELOW PAYMENTS, and that is the one relation in this
// table that is not a preference. Pato, 2026-09-20: *"online orders cannot
// work without online payments"* — Online Orders is prepaid by definition
// ("paid the moment the order is placed"), so a rung carrying Orders without
// Payments is an order button that cannot charge anybody. Prepaid Credits and
// Member Visits have the same dependency. `products.test.ts` pins it, because
// the next person to move a `minPlan` will not read this paragraph.
//
// WHY REWARDS WAS UP AT ULTRA, AND WHY IT IS AT PRO NOW (MESITA-2038).
//
// The original reason still stands on its own terms. Pato: *"rewards must be
// in ultra, because then they will not comply"* — a place promises a discount,
// a guest walks in on the strength of it, and the staff shrug. That failure
// lands on Mesita, not on the venue, and the price was the seriousness filter
// in front of the strike ladder the schema already carries (`strike_count`,
// `plan_forfeited_at`, `promo_paused_until`).
//
// What changed is that the product SPLIT. Three of the four levers — base,
// welcome, Diamond — resolve at quote time and come off the bill at the till,
// with no payment rail and nothing to settle afterwards. Those are at Pro. The
// fourth, the Instagram story, is verified AFTER the bill closes, so it is the
// only one that can need a late top-up, and the only top-up vehicle is Prepaid
// Credits. That stays at Ultra, which is also where Credits is.
//
// So the compliance argument now buys what it was always aiming at, more
// precisely: the lever that can leave a guest waiting on Mesita is the one
// behind the price. `product-rungs.test.ts` pins both rungs.
//
// Anything with real cost of goods (hardware, Capital, the media spend behind
// Ads) is not a rung at all: it prices itself, and only its `minPlan: "ultra"`
// floor lives here.
//
// ── WHAT A BLURB OWES (MESITA-1946) ────────────────────────────────────────
//
// Pato: *"add better descriptions"*. The blurbs used to be one clause each,
// written from the COLUMN they flip — "Receive pickup and delivery orders with
// checkout", "Accept card payments for visits and orders". Set a dozen of those
// in a grid and they are one grey paragraph a dozen times: every card opens
// with a verb Mesita does, none of them says who is better off, and an operator
// meeting the catalogue for the first time cannot tell Orders from Visits or
// Credits from Payments without opening both.
//
// So a blurb names the GUEST and the venue, and carries the one fact that
// distinguishes this product from its neighbour — orders are PREPAID, a visit
// settles the same whether the guest paid cash or card, credits can only be
// spent here, reservations are held by somebody else's provider. It is still
// one sentence, and it still ends in a period: `web-business` pins that shape
// in `products.test.ts`, and this file is that file's snapshot.
//
// ── MOST OF THE SUITE DOES NOT EXIST YET ───────────────────────────────────
//
// Pato, 2026-09-16, with the whole list: *"Put all this shit into the suite"*,
// then *"maybe include POS, but for the future"*. Seven products arrive with
// that — Website, Ads, Terminal, POS, WhatsApp Bot, Phone Bot and Intelligence
// — and NOT ONE of them is built. Neither were Customers and Capital, which is
// why `soon` already outranks every other branch below.
//
// He wrote "(Soon)" beside three of them. The rest get it too, and that is the
// one place this file does not take his list literally: there is no table, no
// migration and no Edge Function behind any of them, and SoonStrip's law is
// that an unbuilt engine shows Soon, never knobs and never a fake number. A
// green chip on a WhatsApp bot that cannot answer anything is the single most
// expensive lie this screen could tell — an owner reads it as "already
// handled" and stops picking up the phone.
//
// SO ELEVEN OF THE TWENTY ARE LIVE (MESITA-2017): Profile, Partner, Reviews,
// Menu, Visits, Orders, Reservations, Payments, Credits, Express Website and
// the Answering Agent — the ten of MESITA-2011 plus the Website, which Pato
// put back at the /autoplan gate. The Website is live on this screen because
// the mock now carries its picker → preview → published states as fixtures
// (`websiteState`), which is exactly the condition the paragraph above sets:
// no knobs on an unbuilt engine, and a state you can click through is not a
// knob. The other nine are exactly his Futuros. That ratio is the point of
// the screen, not a defect in it — the catalogue is a price list before it is
// a control panel.
//
// THIS APP LEADS `apps/web-business`, IT IS NOT A SNAPSHOT OF IT ANY MORE.
// The real console gates on a boolean, has fifteen keys and no `PlanTier`;
// porting this file there is a gate-model change with a migration behind it
// (`places.plan` has no `start`), and it is tracked as MESITA-2017's follow-up
// issue rather than re-snapshotted by hand.
import type { PlaceTab } from "@/lib/place-tabs";
import type { ProductKey } from "@/lib/product-keys";
import {
  isPartner,
  type MockPlace,
  PARTNER_MIN_PLAN,
  PLAN_LABEL,
  type PlanTier,
  planAtLeast,
} from "@/mock/types";

export type ProductState = "free" | "enabled" | "off" | "locked" | "soon";

export type ProductCard = {
  key: ProductKey;
  name: string;
  blurb: string;
  state: ProductState;
  note: string | null;
  action: { label: string; href: string } | null;
};

type PlacePredicate = (p: MockPlace) => boolean;

type ProductSpec = {
  key: ProductKey;
  name: string;
  blurb: string;
  /** The VIEW this product is turned on in, when it has one.
   *
   *  NULL IS THE COMMON CASE NOW, and it is why this field exists at all.
   *  `PLACE_TABS` ⊇ `PRODUCT_KEYS` used to hold, so the catalogue could reach
   *  a product's view with `key as PlaceTab` — a cast that was true by
   *  coincidence and silently survives every product added without one. Most
   *  of the suite has no view now: Customers is a page, Payments is the
   *  sub-step `products/pay`, and every Soon product but Capital has nothing
   *  to open at all. So the tab is written down per product, and the cast is
   *  gone. */
  tab: PlaceTab | null;
  /** THE LOWEST RUNG THAT CARRIES THIS PRODUCT (MESITA-1997) — replacing
   *  `needsPartner: boolean`, which could only ever express two states and so
   *  could not express Ultra at all. Every rung above `minPlan` inherits it,
   *  so Pro's list is never restated inside Ultra's. */
  minPlan: PlanTier;
  atPlace: PlacePredicate | null;
  soon: string | null;
  /** What a LIVE product with no `atPlace` switch says about itself.
   *
   *  THE FALLTHROUGH USED TO ASSERT ONE THING FOR ALL OF THEM — *"Included
   *  with Mesita Partner."* — which was true while every product reaching it
   *  was partner-gated. MESITA-1978 crossed Digital Menu and Answering Agent
   *  to live with `needsPartner: false`, and Omnichannel Access arrived the
   *  same way, so that sentence would have told an operator they are paying
   *  for three things they are not. A product that cannot be switched still
   *  owes the card a true sentence about why. */
  liveNote?: string;
};

/** Exported since MESITA-2009: `PlanComparison` builds every rung's perk
 *  list out of this array, so a column cannot disagree with what a product's
 *  own card says about its floor. */
export const SPECS: readonly ProductSpec[] = [
  {
    key: "profile",
    name: "Mesita Profile",
    blurb:
      "Your public page on Mesita — the photos, the menu and the hours a guest reads before they pick you.",
    tab: "profile",
    minPlan: "free",
    atPlace: null,
    soon: null,
  },
  {
    key: "partner",
    // THE BADGE, SOLD AS NOTHING (MESITA-2011). Pato: *"casi que partner lo
    // quiero meter como un producto… que sea casi un producto"*, second on his
    // list of ten.
    //
    // `minPlan` IS THE WHOLE GATE, and it is not a price on this card: it is
    // the lowest rung that grants the badge, which `PARTNER_MIN_PLAN` holds
    // for every other reader too. Saying it here means `PlanComparison` lists
    // the badge under that rung — what the money buys that the rung below
    // does not have — instead of the ladder and the badge being two stories
    // about one purchase.
    //
    // IT IS PRO, NOT START (2026-09-20). Pato: *"mesita partner until 1000,
    // not 250"*. The badge was the first thing $250 bought and it is now the
    // headline of $1,000 — which also gives Start something to be: the rung
    // that gets you paid, without the thing that says Mesita stands behind
    // you.
    //
    // AND THE NAME IS THE BADGE (MESITA-2021) — Pato's own word for it when
    // he dictated Ultra's list. The reasoning is in `product-keys.ts` above
    // this key; the two strings must stay identical, which is what that file's
    // header is for.
    name: "Partner Badge",
    // WHAT THE BADGE IS FOR, not what it costs. Every other line an operator
    // reads about partnership is about money; this one is the only place that
    // says what the guest gets out of it, which is the reason to want it.
    blurb:
      "The badge on your page, and the rung that grants it — a guest reading the map sees that Mesita stands behind you.",
    tab: null,
    minPlan: PARTNER_MIN_PLAN,
    atPlace: null,
    soon: null,
  },
  {
    key: "reviews",
    // REPUTATION, NOT REVIEWS (MESITA-2025). Pato, 2026-09-20, dictating the
    // twelve perks: *"Online Reputation"*. Third name for this row — Mesita
    // Reviews (MESITA-1995) → Online Reviews → this.
    //
    // A REVIEW IS THE INPUT; THE PRODUCT IS THE AGGREGATE. What this screen
    // shows is Google's stars and how many, Mesita's four scores, and what
    // Instagram and Facebook are saying — one number per source, not a list of
    // reviews. The blurb has said exactly that since MESITA-2011 ("everything
    // the world says back") while the NAME promised a feed, which is the kind
    // of gap an operator only finds by opening the screen.
    //
    // THE KEY STAYS `reviews`, on the `pay` and `visits` precedent: it is the
    // fixture spelling, the half and the tab. The SLUG does NOT — `PRODUCT_SLUG`
    // is the kebab of the NAME for all twenty, so it is `online-reputation`.
    name: "Online Reputation",
    // FOUR SOURCES, WHICH IS THE ARGUMENT FOR THE ROW (MESITA-2011). While
    // this was Profile's Activity half the blurb was Profile's; on its own it
    // has to say why it is not Profile, and the answer is that nothing here is
    // yours to write.
    blurb:
      "Everything the world says back — Google, Instagram, Facebook and Mesita's own stars, counted in one place.",
    tab: null,
    minPlan: "free",
    atPlace: null,
    soon: null,
  },
  {
    key: "menu",
    // DIGITAL MENU (MESITA-1966). Pato: *"Add digital menu as one item"*.
    //
    // ONE ITEM, AND IT IS NOT THE MENUS CARD PROMOTED. What Profile carries
    // today is a NAME plus a file — an upload or a Drive link — which a guest
    // downloads and nothing else in the console can read. This product is the
    // menu as DATA: dishes, prices, what is out of stock tonight.
    //
    // "Digital" IS DOING WORK, which is why the qualifier stays. Every place
    // already has a menu, and half of them already have a PDF of it here; the
    // word that separates this product from both is the one that says the
    // machine can read it.
    name: "Digital Menu",
    // THE BLURB NAMES THE THREE READERS, because that is the whole argument
    // for a fifteenth card: the same dishes are what a guest browses, what
    // Online Orders sells and what the Answering Agent quotes on the phone.
    // Written from the FILE it replaces — "upload your menu" would describe
    // what Profile already does.
    blurb:
      "Your dishes and prices as something Mesita can read — one menu the guest scans, Orders sells from and the Agent quotes.",
    // ITS OWN SCREEN (MESITA-1984). MESITA-1978 pointed this at Profile
    // because that is where `MenusSection` lived; the menus left Profile with
    // this issue, so the borrowed door would now open the one page that no
    // longer holds a menu. `MenuView` is the destination and `ProductPane`
    // mounts it — no `PlaceTab`, because the menu is not a tab.
    tab: null,
    // FREE SINCE MESITA-2025, and it is the only `minPlan` that moved. Pato put
    // it third on the Free rung, under Profile and Online Reputation.
    //
    // THE MENU IS AN INPUT, NOT A SALE. Three products above this one READ it —
    // Express Website renders it, Online Orders sells from it, the Answering
    // Agent quotes it on the phone — so pricing the menu priced the thing they
    // all need before they can do anything. A place that never uploaded one
    // reached Mesita Pro with nothing to sell, which made the rung above look
    // empty for a reason that belonged to the rung below.
    //
    // FREE IS THE WHOLE LISTING NOW: who you are, what the world says back, and
    // what you serve.
    minPlan: "free",
    atPlace: null,
    // WHAT EXISTS INSTEAD, named. An operator who uploaded a PDF last week
    // would otherwise read this card as Mesita losing their menu; the file is
    // still on Profile, it is just not this.
    // LIVE ON PATO'S NEWEST LIST (MESITA-1978). The note it dropped said "A
    // PDF on your Profile is all there is today", which is the thing the
    // product replaces rather than a description of it.
    soon: null,
    liveNote: "On here. Eight dishes, three prices each.",
  },
  {
    key: "website",
    // EXPRESS (MESITA-1956). Pato, after Storefront, Super and Smart were each
    // tried and put down: *"Express Website"*. It names how the site ARRIVES,
    // not what it does, and that is the trade — the transacting is carried by
    // the blurb, which is why the blurb leads with guests ordering and
    // booking.
    //
    // WHAT EXPRESS BUYS over the two that lost: it is a plain CHECKABLE FACT.
    // "Super" could only be taken on trust — the one name in this grid that
    // would be a boast rather than something an operator can verify by reading
    // it. "Smart" is the adjective every competitor in the category already
    // prints on the box (Nuxa's Atlas and Butternut both sell "a site from
    // your Google Business Profile in under two minutes"), so it identifies
    // nothing. The AI stays out of the NAME for the same reason "AI Line"
    // lost: it reads as the differentiator today and as filler in 2028.
    name: "Express Website",
    // IT IS NOT A BROCHURE, and the blurb has to say that in its first breath
    // or the card reads as the domain alias it used to describe ("A real site
    // on your own domain, built from the profile you already keep here") —
    // which is Profile's own sentence with a DNS field bolted on, and is
    // exactly why Pato read this card as nothing.
    //
    // TWO FACTS, BOTH LOAD-BEARING: an AI writes it from the Google listing
    // the place already has, so there is no builder to operate and no
    // templates to pick; and guests TRANSACT on it, which is the whole reason
    // it is a product beside Online Orders rather than a page beside Profile.
    blurb:
      "An AI builds you a working site from your Google listing — guests order and book on it, and you change it by asking instead of dragging boxes.",
    tab: null,
    minPlan: "pro",
    atPlace: null,
    // LIVE ON THE VOICE SESSION'S LIST (MESITA-2017). The picker, the
    // preview and the published site are fixtures now (`websiteState`), which
    // is what this file's header demands before a chip may read On.
    soon: null,
    liveNote: "Pick a template and Mesita drafts the site from your listing.",
  },
  {
    key: "customers",
    // CUSTOMER, NOT GUEST (MESITA-1960). Pato: *"costumer is clearer to
    // understand for business"*. The reader of this card is the VENUE, not the
    // diner, and a business owner thinks in customers. "Guest" stays the word
    // for the PERSON everywhere else — every blurb below says guests, the
    // table on the page still heads its column Guest, and the consumer app
    // calls them guests. Only the product's NAME moves.
    // THIRD NAME, AND THE KEY DID NOT MOVE (MESITA-1980). Guest Catalog →
    // Customer Catalog (MESITA-1960, "costumer is clearer to understand for
    // business") → Customer Intelligence. A CATALOG is a list you read; what
    // this product sells is the READING — who came back, who stopped, who is
    // worth a message — and the list was never the thing being rented.
    //
    // `customers` stays the KEY on `pay`'s precedent: the key is a persisted
    // spelling and the name is what you buy.
    name: "Customer Intelligence",
    blurb:
      "Subscribe to the catalog of everyone who has eaten here: who came back, how often, and what they spend a month.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    // A SUBSCRIPTION, NOT A PURCHASE (MESITA-1941). This card said "Always
    // free" while the page under it sold a contact at a time; both were the
    // old model, and a catalogue card that prices a product differently from
    // its own page is how a venue finds out at the till.
    soon: "Rented with Mesita Ultra, not bought. Nothing is live yet.",
  },
  {
    key: "ads",
    name: "Omnichannel Ads",
    blurb:
      "Reach the people who have not found you yet — Facebook, Instagram and Google, run from here instead of three dashboards.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    soon: "Facebook, Instagram and Google. Nothing is connected yet.",
  },
  {
    key: "visits",
    name: "Member Visits",
    // ONE SENTENCE FOR BOTH HALVES (MESITA-1953), in the order they happen:
    // the bill closes, then a slice goes back. The old pair said them
    // separately and the second one ("you set the rungs, you set the price")
    // was the dial's own sentence — it belongs on the dial, which is where
    // Rewards' view still is.
    // NO TIERS IN THE SENTENCE (MESITA-2017): the rates are Mesita's, and what
    // a place decides is which actions earn and how much a visit may cost.
    blurb:
      "Close the bill at the table and give a slice of it back — cash or card settles the same way, and you switch on what earns it.",
    tab: "visits",
    minPlan: "pro",
    // RUNG-GATED, NOT `visitRewards`. Member Visits comes with the Pro rung
    // and has no per-place switch; only the rewards half has one. (It used to
    // read "included with the Membership"; there is no Membership since
    // MESITA-2019, which is also what freed "Member" for this card's name.)
    // Reading the merged card off that toggle would print "Off" for a place
    // whose visits work fine — a card stating a fact that is not true, which
    // is the one thing this grid may not do. The card says the product is
    // available; the dial says how much comes back.
    atPlace: null,
    soon: null,
  },
  {
    key: "orders",
    name: "Online Orders",
    // PICKUP FIRST (MESITA-2017). Pato: *"sólo permitir pickup al principio
    // estaría muy bien"*. Six channels feed one queue; delivery is the section
    // on the page that says Soon, so the card may not promise it.
    blurb:
      "Pickup from six channels, paid the moment the order is placed — a no-show costs the guest, never your kitchen.",
    tab: "orders",
    minPlan: "pro",
    atPlace: (p) => p.pickupOrders || p.deliveryOrders,
    soon: null,
  },
  {
    key: "tableorders",
    // THE ORDER PLACED AT THE TABLE (MESITA-1978), which is not Online Orders
    // with a different address: pickup and delivery leave, this one stays and
    // joins an open visit, so the bill is the thing it edits.
    name: "Table Orders",
    blurb:
      "The guest orders from the table and it joins their open bill — no pickup, no delivery, no second screen for the floor.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    soon: "Nothing is built yet.",
  },
  {
    key: "reservations",
    // *"and reservations call it online reservations"* (Pato, 2026-09-16).
    // MESITA-1955 left this one bare while its two neighbours took the
    // qualifier; a lone unqualified noun between Online Orders and Online
    // Payments reads as the odd one out rather than as the plain case.
    name: "Online Reservations",
    blurb:
      "The table bookings your own provider already holds, read here beside everything else this place does.",
    tab: "reservations",
    minPlan: "pro",
    atPlace: (p) => p.reservations,
    soon: null,
  },
  {
    key: "pay",
    name: "Online Payments",
    // NO TAB, on purpose: this place's Stripe account is the sub-step
    // `products/pay`, not a view beside Visits and Orders.
    blurb:
      "This place’s own Stripe account, so a guest can pay by card at the table and the money lands with you.",
    tab: null,
    minPlan: "pro",
    atPlace: null,
    soon: null,
  },
  {
    key: "terminal",
    // DIGITAL TERMINAL, NOT "Physical Terminal" (MESITA-2037). Pato:
    // *"Use \"Answering Agent\" (singular) and \"Digital Terminal\"
    // everywhere."*
    //
    // IT BREAKS A RHYME ON PURPOSE. MESITA-1958 paired this with Physical POS
    // — *"the two boxes on your counter"* — and spelling one out while the
    // other kept its qualifier was the thing that argument refused. The pair
    // is broken now, and the reason is that PHYSICAL was never the true
    // distinction: Online Payments and this product both take a card, and what
    // separates them is whose screen the tap happens on, not whether the thing
    // has a body. The POS keeps `Physical` because its opposite really is a
    // software till.
    name: "Digital Terminal",
    // BACK AFTER MESITA-1900 TOOK IT OUT, on Pato's 2026-09-16 list, and still
    // Soon for the same reason it left: there is no hardware. The old blurb
    // ("Take in-person payments with Mesita hardware") named the box; this one
    // names why a place that already has Payments would want one.
    blurb:
      "A card reader on your counter for the guests who will never open their phone, on the same bill as everyone else.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    soon: "Mesita hardware is not available yet.",
  },
  {
    key: "pos",
    // PHYSICAL POS, NOT "Point of Sale" (MESITA-1958). Pato: *"rename point of
    // sale to Physical POS"*, which is what his original list said and which
    // MESITA-1955 overrode on the argument that the till needed spelling out.
    // The pairing is the better argument: Physical Terminal and Physical POS
    // are the two boxes on your counter, and spelling one out while the other
    // keeps its qualifier broke the only rhyme the money row had. The blurb
    // spells out the till anyway.
    name: "Physical POS",
    // *"maybe include POS, but for the future"* (Pato, 2026-09-16). FOR THE
    // FUTURE IS A REAL DISTINCTION and the note carries it: everything else
    // here is unbuilt, but POS is the only one he put behind the others, and a
    // card that reads exactly like Terminal's would lose that.
    //
    // THE BLURB HAS TO SAY WHAT IT IS NOT. A place that already has Visits and
    // Terminal can reasonably ask what a third counter product is for, so this
    // one names the half Mesita does not do today: the items, and the ticket to
    // the kitchen. Visits closes a bill; POS is what put the bill together.
    blurb:
      "The till itself — items rung up, the ticket to the kitchen, and the bill Visits closes, on one system.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    soon: "The furthest out of everything here. Nothing is live yet.",
  },
  {
    key: "orderpad",
    // HARDWARE, LIKE TERMINAL AND POS (MESITA-1978), and it says which one it
    // is: a pad the floor carries, not a station they walk back to.
    name: "Physical Orderpad",
    blurb:
      "A pad the floor carries: take the order at the table and it reaches the kitchen without a walk back to a station.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    soon: "Mesita hardware is not available yet.",
  },
  {
    key: "credits",
    name: "Prepaid Credits",
    // CAMPAIGNS, AND SISTER BRANCHES (MESITA-2017). It used to say the balance
    // "can only be spent here"; the session made acceptance a one-way choice
    // a sister branch makes, with the issuer keeping the cash and the debt.
    blurb:
      "Cash now for meals later — you open a campaign, guests buy a balance at a bonus, and a sister branch can choose to honour it.",
    tab: "credits",
    minPlan: "ultra",
    atPlace: (p) => p.credits,
    soon: null,
  },
  {
    key: "capital",
    name: "Mesita Capital",
    // THE LANDING PAGE'S OWN WORDS, on purpose: the pitch an owner read before
    // signing up is the pitch they meet inside. "Not a loan" is load-bearing —
    // Mesita buys inventory forward, it does not lend, so the verb here is
    // always BUY and the word never appears.
    //
    // MESITA-1946 took the second clause from `web-landing`'s own paragraph
    // ("Mesita pre-buys a restaurant's future meals at a deep discount and
    // resells that inventory to guests. The place gets cash now...") rather
    // than writing a new one: the mechanism is the reason the product is not a
    // loan, and a card that states only the cash states the half an owner
    // already believes.
    blurb:
      "Mesita pre-buys your future meals at a discount and resells them to guests — you take the cash now.",
    tab: "capital",
    minPlan: "ultra",
    atPlace: null,
    soon: "An advance sale of food, never a loan. Nothing is live yet.",
  },
  {
    key: "line",
    // ANSWERING AGENT (MESITA-1960) — the sixth name in two days: WhatsApp Bot
    // + Phone Bot → AI Line → Mesita Host → Call Center → Phone Agent → here.
    // It is the first that is none of the three bad shapes.
    //
    // THE SHAPE PROBLEM, written down so this stops recurring: this card names
    // a REPLACEMENT FOR A PERSON, and English offers three shapes for that —
    // the CHANNEL (Call Center, AI Line, Phone Agent), the ROLE (Host,
    // Reception) or the CATEGORY (Answering Service). Every one of them costs
    // something: a channel is wrong the day a second one arrives, a role reads
    // like hiring, and the category reads like 1985.
    //
    // THIS NAME TAKES THE VERB INSTEAD. `Agent` is kept, because it is what
    // beat Call Center — one thing acting on your behalf, where "Center"
    // implied a room full of people and made the card read as headcount.
    // `Answering` replaces the wire with the JOB, which is what MESITA-1951
    // was reaching for when it merged the two bots: a call and a WhatsApp are
    // both answering, so a third channel costs this name nothing.
    //
    // Do not re-open it without a stated defect.
    name: "Answering Agent",
    // IT ANSWERS A NUMBER, NOT AN APP, and the blurb has to say that or the
    // card reads as a WhatsApp widget. The two things it replaced were named
    // for their channels ("Mesita WhatsApp Bot", "Mesita Phone Bot"), which is
    // what made them look like two products; one line, two ways in.
    // BOOKINGS AND PICKUP ORDERS, AND A WAY OUT (MESITA-2017). The session's
    // three requirements for v1: reservations, pickup orders paid by Stripe
    // link before the kitchen starts, and escalation to a person.
    blurb:
      "Answers your number — a call or a WhatsApp — takes the booking and the pickup order, and hands a person anything it cannot.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    soon: null,
    liveNote: "Answering your number. Nothing to set here yet.",
  },
  {
    key: "access",
    // DEVELOPERS PLATFORM (MESITA-1991). Pato: *"i want to move the
    // omnichannel access as a product for Developers Platform… like its now a
    // product kinda"*.
    //
    // OMNICHANNEL ACCESS WAS TWO THINGS WEARING ONE NAME. 🦚 Main §4 defines
    // it as "the console on the web, the business app on your phone, and an
    // API into the systems you already run". The first two are surfaces this
    // console already IS — a product card for "you are looking at it" sells
    // nothing and configures nothing — and the third is a real product a place
    // switches on, hands to whoever builds for them, and can have running or
    // not. That third thing is what keeps the row.
    //
    // THE KEY STAYS `access`, on `pay`'s and `visits`' precedent: a key is a
    // persisted spelling and the name is what you buy. The SLUG moves with the
    // name, because a slug is what a person types.
    name: "Developers Platform",
    blurb:
      "An API and keys into the systems you already run, so orders and bookings land in your POS instead of a screen somebody has to watch.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    soon: null,
    // THE NOTE NAMES WHAT YOU GET, NOT WHAT THE PANE ALREADY SAYS
    // (MESITA-1992). It used to read "Keys are issued per place, never per
    // person" — which is now a bolded sentence inside the pane's own API key
    // card, eleven words below it. Two placements of one sentence is what made
    // other cards look padded, so the note carries the pair instead: an API
    // key AND an MCP connector, which is the thing an operator did not know
    // was in here.
    liveNote:
      "On for every place: one API key, and an MCP connector your AI assistant can use.",
  },
  {
    key: "intelligence",
    // MARKETING, NOT MARKET (MESITA-1958). Pato: *"rename market intelligence
    // to marketing intelligence"*. "Market" points OUTWARD — the category, the
    // competition, what the neighbourhood is doing — and this product reads
    // nothing outside: its own note says it reads what your other products
    // record. Marketing is the work it feeds.
    name: "Marketing Intelligence",
    blurb:
      "What to change and why: who to bring back, what to charge, and where this place is quietly losing guests.",
    tab: null,
    minPlan: "ultra",
    atPlace: null,
    // IT READS THE OTHERS, and that is the honest prerequisite to state. An
    // advice engine over a place with no visits, no orders and no customer
    // catalog has nothing to be right about.
    soon: "Reads what your other products record. Nothing is live yet.",
  },
];

export const PRODUCT_ORDER: readonly ProductKey[] = SPECS.map((s) => s.key);

/** Each product's rung, keyed for readers that hold a `ProductKey` and not a
 *  spec — the catalogue prints it under every box (MESITA-1999). Derived from
 *  SPECS so it cannot drift from the gate `buildProductCards` applies. */
export const MIN_PLAN = Object.fromEntries(
  SPECS.map((spec) => [spec.key, spec.minPlan]),
) as Record<ProductKey, PlanTier>;

export function buildProductCards(input: {
  /** THE RUNG, not a boolean (MESITA-1997). `partnered` is derivable from it
   *  and no longer passed: a caller holding both could hand in a pair that
   *  cannot exist, and the gate would have to pick one to believe. */
  plan: PlanTier;
  mesitaPayEnabled: boolean;
  /** NULL MEANS THE READ FAILED. An empty portfolio is a different fact, and a
   *  card must not print a count it did not read. */
  place: MockPlace | null;
  placeHref: (view: PlaceTab) => string;
  payHref: string;
}): ProductCard[] {
  const { plan, mesitaPayEnabled, place, placeHref, payHref } = input;
  /** A verb, but only where there is somewhere to send it. A spec with no tab
   *  in a branch that wants one would otherwise render a button to `/places/
   *  <id>/undefined`. */
  const viewAction = (spec: ProductSpec, label: string) =>
    spec.tab ? { label, href: placeHref(spec.tab) } : null;
  return SPECS.map((spec): ProductCard => {
    if (spec.soon) {
      return { ...base(spec), state: "soon", note: spec.soon, action: null };
    }
    // It is not bought, cannot be switched off, and exists on a place that has
    // never heard of Mesita, because the Enricher built it. A
    // `needsPartner: false` product with no `atPlace` would otherwise fall
    // through to "enabled", which reads as something somebody turned ON.
    // FREE, AND IT IS A PAIR AGAIN (MESITA-2011). The ternary comes back with
    // Online Reputation: both are on for every place and neither can be
    // switched, but only one of them is something the operator WROTE. The
    // distinction is the whole reason reputation is its own row again, so the
    // note has to carry it rather than printing Profile's sentence twice.
    //
    // STILL A PAIR AFTER MESITA-2025, and that is the point of this branch
    // rather than a `minPlan === "free"` check. Digital Menu joined them on the
    // Free rung and does NOT belong here: a menu is uploaded, it can be empty,
    // and it reads On HERE. `free` is a claim about what cannot be switched,
    // not about what costs nothing.
    if (spec.key === "profile" || spec.key === "reviews") {
      return {
        ...base(spec),
        state: "free",
        note:
          spec.key === "profile"
            ? "Always free. Every place has one."
            : "Always free. Nobody here can turn off what the world says.",
        action: viewAction(spec, "Manage"),
      };
    }
    // THE BADGE, WHICH IS NOT A PURCHASE AND NOT A SWITCH (MESITA-2011).
    //
    // IT IS ANSWERED ABOVE THE LOCKED BRANCH ON PURPOSE. A Free place would
    // otherwise read "Needs Mesita Ultra." with no verb, which is the right
    // sentence for a product behind a rung and the wrong one for this: the
    // badge is the one row where the rung IS the subject, so a place that has
    // not bought one needs the door to the ladder, not a closed sign. Off with
    // a way in, never Locked.
    //
    // `plan`, NOT `place.partnered`. The two agree — `scenario.ts` derives one
    // from the other — and a card that read the derived field would be the
    // second reader of a fact this function already holds.
    //
    // THE OFF SENTENCE NAMES THE RUNG FROM THE CONSTANT (2026-09-20), because
    // the rung moved once and the sentence that named it by hand would have
    // been the line still selling the badge at $250.
    if (spec.key === "partner") {
      const partnered = isPartner(plan);
      return {
        ...base(spec),
        state: partnered ? "enabled" : "off",
        note: partnered
          ? `On here. ${PLAN_LABEL[plan]} carries the badge.`
          : `Not a partner yet. Any rung from ${PLAN_LABEL[PARTNER_MIN_PLAN]} up grants it.`,
        action: null,
      };
    }
    // LOCKED CARRIES NO VERB. A button on a product the caller cannot have is
    // an invitation to a 403.
    //
    // AND IT NAMES THE RUNG IT NEEDS (MESITA-1997). "Needs Mesita Partner."
    // was true while there was one thing to buy; with two, a locked card that
    // does not say WHICH sends an operator to the wrong price. The label comes
    // off `PLAN_LABEL` so the card and the ladder can never disagree about
    // what the rung is called.
    if (!planAtLeast(plan, spec.minPlan)) {
      return {
        ...base(spec),
        state: "locked",
        note: `Needs ${PLAN_LABEL[spec.minPlan]}.`,
        action: null,
      };
    }
    if (spec.key === "pay") {
      return {
        ...base(spec),
        state: mesitaPayEnabled ? "enabled" : "off",
        note: mesitaPayEnabled
          ? "On here. Guests can pay by card."
          : "Set up this place's Stripe account first.",
        action: { label: mesitaPayEnabled ? "Manage" : "Set up", href: payHref },
      };
    }
    if (spec.atPlace) {
      const enabled = place !== null && spec.atPlace(place);
      return {
        ...base(spec),
        state: enabled ? "enabled" : "off",
        note: place ? (enabled ? "On here." : "Not on here yet.") : null,
        action: viewAction(spec, enabled ? "Manage" : "Enable"),
      };
    }
    return {
      ...base(spec),
      state: "enabled",
      // The rung that carries it, named — the same string the Locked branch
      // prints, so a product reads the same before and after the purchase
      // that unlocked it. `free` never reaches here: Profile and Reviews are
      // answered above, and the other two free products carry a `liveNote`.
      note: spec.liveNote ?? `Included with ${PLAN_LABEL[spec.minPlan]}.`,
      action: viewAction(spec, "Manage"),
    };
  });
}

function base(spec: ProductSpec) {
  return { key: spec.key, name: spec.name, blurb: spec.blurb };
}
