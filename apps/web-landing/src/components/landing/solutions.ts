// The eleven product solutions, as 🦚 Main §§ 3–4 names them: six for the
// guest, five for the place. Digital Payments, Credit Prepayments and Credit
// Rewards are shared by both sides and struck through on Main (not built), so
// they carry `soon` and the page tags them instead of hiding them. Order is
// Main's order; rename a product on Main first, then here.

export type Solution = {
  name: string;
  body: string;
  /** Discovery's five ways, printed as chips under the body. */
  ways?: string[];
  soon?: boolean;
};

export const GUEST_SOLUTIONS: Solution[] = [
  {
    name: "Global Catalog",
    body: "Every restaurant, café, bar and club in the city, including places that have never heard of Mesita. Photos, hours, reviews and channels in one profile, built from Google and the open web.",
  },
  {
    name: "Discovery Engines",
    body: "Find your next place five ways: type its name, browse what is near or popular in forty one-word families, read the map, ask Don Memo in your own words, or see what places are posting.",
    ways: ["Name", "Catalog", "Map", "Deep", "Social"],
  },
  {
    name: "Reservations Agent",
    body: "Ask for a table and the Reservationist makes the call. It phones the place with your date, time and party size, and comes back with a confirmation or alternatives.",
  },
  {
    name: "Digital Payments",
    body: "Pay the bill from your phone. Scan the QR on the table and pay by card, Apple Pay or Google Pay, straight to the place. No account needed.",
    soon: true,
  },
  {
    name: "Credit Prepayments",
    body: "Buy a place’s meals ahead at the bonus it offers, pay 100 and hold 110. Keep it, gift it, or send it to a friend.",
    soon: true,
  },
  {
    name: "Credit Rewards",
    body: "A percent of every payment back as credit at that same place, for the next visit. See what you earn before you pay.",
    soon: true,
  },
];

export const PLACE_SOLUTIONS: Solution[] = [
  {
    name: "Mesita Profile",
    body: "Your page already exists, built by AI from your Google listing and other public sources. Claim it to control photos, hours, channels and the presentation guests read. Free forever.",
  },
  {
    name: "Premier",
    body: "The one paid mark in Mesita. Subscribe at 2X or 5X and your score multiplies in every Discovery search, always marked Ad. It orders, never excludes. Cancel any month.",
  },
  {
    name: "Digital Payments",
    body: "Accept card, Apple Pay and Google Pay on your own Stripe account, opened in minutes. Funds settle to you and you are the merchant of record.",
    soon: true,
  },
  {
    name: "Credit Prepayments",
    body: "Sell your meals before they are eaten. Set the bonus, let guests buy, gift and send credit that spends only with you, and get the money the day it is bought.",
    soon: true,
  },
  {
    name: "Credit Rewards",
    body: "Fund a percent back on every payment, paid as credit at your place, never cash. You set the rate and the cap; the credit brings the guest back.",
    soon: true,
  },
];
