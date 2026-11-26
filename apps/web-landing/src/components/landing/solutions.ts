// The solutions, as 🦚 Main names them (MESITA-4991): four for the guest
// (§ 3) and four for the restaurant (§ 4). A solution is what the guest or the
// owner receives, so the page lists outcomes, never modules. Paying ahead is
// not live with real money yet, so every row that depends on it carries
// `soon` and the page tags it instead of hiding it. Rename on Main first,
// then here.

export type Solution = {
  name: string;
  body: string;
  /** Discovery's five ways, printed as chips under the body. */
  ways?: string[];
  soon?: boolean;
};

export const GUEST_SOLUTIONS: Solution[] = [
  {
    name: "Global Discovery",
    body: "Every restaurant, café, bar and club in the city, including places that have never heard of Mesita, each with photos, hours, reviews and channels in one profile. Find your next place by name, nearby, on the map, by asking in your own words, or by what people around you are looking at.",
    ways: ["Name", "Nearby", "Map", "Ask", "Social"],
  },
  {
    name: "Reservations Agent",
    body: "Ask for a table and Mesita makes the call. Its agent phones the place with your date, time and party size, and comes back with a confirmation or the other times the place offered.",
  },
  {
    name: "Visit Discounts",
    body: "Pay a place ahead and get more to spend there: pay MX$1,000, get MX$1,200. Your credit spends only at that place and never expires.",
    soon: true,
  },
  {
    name: "Gift Credits",
    body: "Give a friend credit at a place you recommend. They spend it there, on their own visit.",
    soon: true,
  },
];

export const PLACE_SOLUTIONS: Solution[] = [
  {
    name: "New Customers",
    body: "Get found by diners who have not visited yet. Your profile is already in front of people choosing where to go, and they can ask Mesita to book a table with you. A Welcome offer wins the first visit.",
  },
  {
    name: "Returning Customers",
    body: "Give guests a reason to come back. The bonus on what they pay ahead arrives three hours later, after the meal, so it always pays for another visit.",
    soon: true,
  },
  {
    name: "Wholesale Presale",
    body: "Sell several visits upfront. Regulars buy enough credit for many meals in one purchase at a better price, and you are paid before they come.",
    soon: true,
  },
  {
    name: "VIP Customers",
    body: "Bring in the guests who bring others. A VIP code from your place unlocks a stronger offer for them, and its bonus brings them back.",
    soon: true,
  },
];

// What comes after the four, by name only (🦚 Main § 6). One line on the
// page, never a row each: a list of Soon rows reads as a roadmap.
export const PLACE_LATER = [
  "Menu",
  "Website",
  "Orders",
  "Deliveries",
  "Content",
  "Ads",
  "Capital",
];
