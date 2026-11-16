// The product solutions. Guests: three, as 🦚 Main names them (MESITA-4190,
// Pato: "Simplification. No cashbacks."): Global Discovery, Reservations Agent,
// Discounted Prepayments. Discounted Prepayments is not live with real money
// yet, so it carries `soon` and the page tags it instead of hiding it.
// Restaurants: every product on Business › All (web-business
// places/[id]/all), same names, same copy, same order: four current, ten Soon
// (MESITA-3845, Pato: "List all this in the Solutions for Restaurants").
// Rename a product there first, then here.

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
    body: "Every restaurant, café, bar and club in the city, including places that have never heard of Mesita, each with photos, hours, reviews and channels in one profile. Find your next place five ways: type its name, browse what is near or popular in forty one-word families, read the map, ask Don Memo in your own words, or see what people nearby are looking at.",
    ways: ["Name", "Catalog", "Map", "Deep", "Social"],
  },
  {
    name: "Reservations Agent",
    body: "Ask for a table and the Reservationist makes the call. It phones the place with your date, time and party size, and comes back with a confirmation or alternatives.",
  },
  {
    name: "Discounted Prepayments",
    body: "Pay a place ahead and get more to spend there: pay MX$1,000, spend MX$1,200. Your credit never expires, spends only at that place, and you can send it to a friend.",
    soon: true,
  },
];

export const PLACE_SOLUTIONS: Solution[] = [
  {
    name: "Profile",
    body: "What guests read about your place: basics, hours, location and links, and what they say on Google, Instagram and Facebook. Edit it here and preview it the way guests see it.",
  },
  {
    name: "Premier",
    body: "Rank higher on Home and the Map, marked as an ad. See your level here and how it works.",
  },
  {
    name: "Payments",
    body: "House Credits, Cash Payments, App Payments, their Cashback-as-Credits, App Prepayments and the Stripe Account, and which of them are on at your place.",
  },
  {
    name: "Reservations",
    body: "Whether guests can ask for a table at your place. When they do, Mesita's Reservationist calls you with the date, time and party size.",
  },
  {
    name: "Smart Menu",
    body: "Your interactive menu, built by AI from a photo, file or website, approved by you and hosted on Mesita. Guests open it from a QR code or link with no account, ask its AI questions, and order and pay directly, at your place or from anywhere.",
    soon: true,
  },
  {
    name: "Express Website",
    body: "A website on your own domain, made from your Mesita profile with the same menu, hours and photos. Change it by asking, with ordering and reservation buttons already connected.",
    soon: true,
  },
  {
    name: "Mesita Capital",
    body: "Cash upfront, by selling an agreed amount of future credit at your restaurant to Mesita at a discount. Mesita gives that credit to guests, who redeem it over time, so the funding brings visits with it.",
    soon: true,
  },
  {
    name: "Marketing Agent",
    body: "Connects to Google and Meta. Uses Higgsfield to turn your profile data and guests' Instagram Stories, with their permission, into AI content made to go viral. Create your content, post it to your feed and boost it with ads on every channel, all from one place.",
    soon: true,
  },
  {
    name: "Answering Agent",
    body: "Agents connected to all your channels, including phone, WhatsApp and text, that know your business: hours, menu and bookings. They turn questions into orders and bookings, so your staff get structured information instead of scattered calls and messages.",
    soon: true,
  },
  {
    name: "Orders Management",
    body: "One queue for every order, labeled by source: Mesita members, your website and agents, and Uber Eats, Rappi and DiDi Food. Manage status, prep time, cancellations and sold-out items, and see the day's delivery sales.",
    soon: true,
  },
  {
    name: "Reservations Management",
    body: "One calendar for every booking, labeled by source: Mesita members, your website and agents, and outside booking systems, synced so tables aren't double-booked. Manage availability, confirmations, reminders, changes and cancellations, with every booking tied to its guest.",
    soon: true,
  },
  {
    name: "Mesita CRM",
    body: "One record per guest, built from every booking, order, visit and redemption, with history, notes, tags and preferences so staff recognize who's at the door. Message guests on WhatsApp, SMS and email from that record, with every message logged.",
    soon: true,
  },
  {
    name: "Mesita Terminal",
    body: "A card device connected to the Mesita bill. Guests tap or insert their card at the counter or table, staff see the result on the right bill, and online and in-person payments reconcile in one place.",
    soon: true,
  },
  {
    name: "Mesita POS",
    body: "Take orders, track the kitchen and close bills on a point of sale connected to your Smart Menu. Counter, table and online sales share the same guest, rewards and payment records.",
    soon: true,
  },
];
