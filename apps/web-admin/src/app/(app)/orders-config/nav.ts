import { ShoppingBag } from "lucide-react";

// One sidebar entry — "Orders". The REMOTE context: Mesita prices two, a visit
// (the guest is at the place) and an order (the guest is not), and only visits
// shipped. Sits between Visits and Reservations because that is a guest's night
// — sit down, or order instead.
//
// Rates are NOT configured here. What an order would pay lives in the Promos
// grid's parked `orders` context; visit rates live on Visits as Visits Rewards.
// This page is everything else about an order existing at all.
export const ORDERS_PARENT = {
  href: "/orders-config",
  label: "Orders",
  Icon: ShoppingBag,
} as const;
