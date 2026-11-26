// The page says what 🦚 Main says (MESITA-4994, Pato: "landing page must say
// the shit notion says. don't mention soon for anything."). Main's own
// sentences, trimmed of what only matters inside Mesita: § 3 Consumer
// Solutions, § 4 Restaurant Solutions, § 5 Restaurant Modules. Two rows follow
// newer decisions instead of Main: VIP is by code (MESITA-4849) and Checkout
// is led by the waiter (2026-11-24). Change Main first, then here.

export type Solution = {
  name: string;
  body: string;
  /** Discovery's five ways, printed as chips under the body. */
  ways?: string[];
};

export const GUEST_SOLUTIONS: Solution[] = [
  {
    name: "Global Discovery",
    body: "Find somewhere to go out. Mesita builds and updates a catalog of restaurants, cafés, bars and clubs in each city it serves, using Google Places and other public sources, so places appear before they sign up. Browse nearby or popular places on Home, filter by category, explore the map or search directly. The Social feed shows what people nearby are viewing and liking. Paid Premier placements are labeled Ad.",
  },
  {
    name: "Reservations Agent",
    body: "Ask Mesita to book a table. Give it a date, time and party size, and its voice agent calls the place for you. It reports back with a confirmation, other times the place offered, or a clear answer that it couldn’t book. It can call places that haven’t signed up. Free guests get 10 reservation requests a month, and Pro guests get 30.",
  },
  {
    name: "Visit Discounts",
    body: "Pay upfront and get more credit than you paid for. Classic Offers give +10% to +30% depending on the amount. The Welcome offer gives +100%, once, to a guest who is new to the place. What you pay is ready right away, and the bonus arrives 3 hours later. The credit works only at the place that issued it and never expires.",
  },
  {
    name: "Gift Credits",
    body: "Give someone credit to spend at a place you recommend, straight from your own balance.",
  },
];

export const PLACE_SOLUTIONS: Solution[] = [
  {
    name: "New Customers",
    body: "Get discovered by diners who haven’t visited yet. Global Discovery puts the restaurant in front of people browsing or searching for somewhere to go, when it matches what they’re looking for. The Welcome voucher wins the first visit, and its bonus brings the guest back for a second.",
  },
  {
    name: "Returning Customers",
    body: "Give guests a reason to come back. The bonus on a prepaid purchase arrives three hours later, so it always pays for another visit. Guests can also gift that credit to a friend as a personal recommendation.",
  },
  {
    name: "Wholesale Presale",
    body: "Sell several visits upfront at a better price. Regulars who eat there often get a discount when they buy enough credit for several meals in one purchase. The restaurant gets paid upfront, and the guests spend the credit over time.",
  },
  {
    name: "VIP Customers",
    body: "Attract high-value guests who can bring new diners. A VIP code from the restaurant unlocks the VIP voucher, a stronger reason to visit, and its bonus credit brings them back.",
  },
];

export const MODULES: Solution[] = [
  {
    name: "Profile",
    body: "The place’s free page in Mesita, built by AI from its Google listing, reviews and other public sources. The owner claims it and edits it; anything they edit stays the way they set it.",
  },
  {
    name: "Premier",
    body: "The paid plan that ranks the place higher, always marked Ad: Pro at US$99 a year doubles the place’s score and Max at US$999 a year multiplies it by five. Premier only orders; guests still see the place only when it matches what they asked for.",
  },
  {
    name: "Reservations",
    body: "The voice agent that phones the place. The owner sets the number to dial or switches reservations off.",
  },
  {
    name: "Payments",
    body: "The place’s own Stripe account and the payments made through it by card, Apple Pay and Google Pay. Mesita’s fee is 5%. The money goes straight to the place; Mesita never holds it.",
  },
  {
    name: "Credits",
    body: "The credit guests hold at the place. It holds the credits agreement, the outstanding balance and the limit on how much credit the place can issue.",
  },
  {
    name: "Vouchers",
    body: "The products a guest buys ahead. Each voucher is its own switch, so the place sells only the offers it wants.",
  },
  {
    name: "Checkout",
    body: "Closing the bill of a visit. The waiter sends the bill to the guest’s phone; the guest’s credit pays first, and what is left is paid by card or cash. One six-digit code, shared by the whole place, confirms it.",
  },
  {
    name: "Customers",
    body: "The list of who came, how often and what they spent. It is the place’s customer record.",
  },
];
