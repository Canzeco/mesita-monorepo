import { ShoppingBag } from "lucide-react";

// One sidebar entry — "Orders". The REMOTE context: Mesita prices two, a visit
// (the guest is at the place) and an order (the guest is not), and only visits
// shipped. Sits between Reservations and Rewards because that is the order of a
// guest's night: find a place, book it, or order instead — then get paid.
//
// Rates are NOT configured here. What an order pays lives in the Promos grid's
// `orders` context, behind its own additivity guard; this page is everything
// else about an order existing at all.
export const ORDERS_PARENT = {
  href: "/orders-config",
  label: "Orders",
  Icon: ShoppingBag,
} as const;
