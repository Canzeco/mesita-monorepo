// The seven Activity chips' words and icons (MESITA-3688), in the order of
// ACTIVITY_TYPES. Activity's rail and Me's tiles both read this, so a chip
// and its tile never disagree. A plain module: Me's hub (a server module)
// imports it.

import {
  Bell,
  CalendarCheck,
  Gift,
  Heart,
  type LucideIcon,
  ReceiptText,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/activity-types";

export type ActivityChip = {
  type: ActivityType;
  label: string;
  Icon: LucideIcon;
  /** Me's tile line: three words or fewer. */
  summary: string;
};

const CHIPS: Record<ActivityType, Omit<ActivityChip, "type">> = {
  notifications: {
    label: "Notifications",
    Icon: Bell,
    summary: "Bookings and updates",
  },
  favorites: { label: "Favorites", Icon: Heart, summary: "Places you saved" },
  reservations: {
    label: "Reservations",
    Icon: CalendarCheck,
    summary: "Upcoming and past",
  },
  visits: {
    label: "Visits",
    Icon: UtensilsCrossed,
    summary: "Tables you paid",
  },
  payments: {
    label: "Payments",
    Icon: ReceiptText,
    summary: "Bills and cashback",
  },
  prepayments: {
    label: "Prepayments",
    Icon: Wallet,
    summary: "Credits you bought",
  },
  gifts: { label: "Gifts", Icon: Gift, summary: "Sent and received" },
};

export const ACTIVITY_CHIPS: readonly ActivityChip[] = ACTIVITY_TYPES.map(
  (type) => ({ type, ...CHIPS[type] }),
);
