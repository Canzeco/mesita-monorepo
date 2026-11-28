// The page says what 🦚 Main says (MESITA-4994, Pato: "landing page must say
// the shit notion says. don't mention soon for anything."). Main's own
// sentences, trimmed of what only matters inside Mesita: § 3 Consumer
// Solutions, § 4 Restaurant Solutions, § 5 Restaurant Modules. Checkout is
// led by the waiter (MESITA-4999) and offers are what the app sells
// (MESITA-5126): four vouchers and one credit-back rate, every reward credit,
// no discounts and no VIP lines. Main's Instagram Stories is left out until
// the app pays a Story Reward. Change Main first.

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
    body: "Pay upfront and get more credit than you paid for: Welcome MX$100 (one per guest per place), Small MX$200, Medium MX$1,000 and Big MX$5,000, each with a bonus the place picks, up to +60%. What you pay and the bonus land together 3 hours later. The credit works only at the place that issued it and never expires. Paying a bill also earns credit back: one rate, 5%, on every bill. Every reward is credit at that place; there are no discounts off the bill.",
  },
  {
    name: "Gift Credits",
    body: "Give someone credit to spend at a place you recommend, straight from your own balance.",
  },
];

export const PLACE_SOLUTIONS: Solution[] = [
  {
    name: "New Customers",
    body: "Get discovered by diners who haven’t visited yet. Global Discovery puts the restaurant in front of people browsing or searching for somewhere to go, when it matches what they’re looking for. The Welcome voucher (pay MX$100, get +30% or +60%, one per guest) makes the first visit a Mesita visit.",
  },
  {
    name: "Returning Customers",
    body: "Give guests a reason to come back. The bonus on a prepaid purchase arrives three hours later, so it always pays for another visit. Guests can also gift that credit to a friend as a personal recommendation.",
  },
  {
    name: "Wholesale Presale",
    body: "Sell several visits upfront at a better price. Regulars who eat there often get a discount when they buy enough credit for several meals in one purchase. The restaurant gets paid upfront, and the guests spend the credit over time.",
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
    body: "Closing the bill of a visit, led by the waiter. The guest shows a QR; the waiter scans it and sends the bill with the place’s one six-digit code. The guest’s credit pays first, and what is left is paid at the place, in cash or on its own terminal.",
  },
  {
    name: "Customers",
    body: "The list of who came, how often and what they spent. It is the place’s customer record.",
  },
];
