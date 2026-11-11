// The five Activity chips' words and icons (Favorites left in MESITA-3723) (MESITA-3697; Notifications back
// with MESITA-3716), in the order of
// ACTIVITY_TYPES. Activity's rail and Me's tiles both read this, so a chip
// and its tile never disagree. A plain module: Me's hub (a server module)
// imports it.

import {
  Bell,
  CalendarCheck,
  Gift,
  type LucideIcon,
  Ticket,
  UtensilsCrossed,
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
  reservations: {
    label: "Reservations",
    Icon: CalendarCheck,
    summary: "Upcoming and past",
  },
  // Visits holds the payments (MESITA-3697): the tables and what paid them.
  visits: {
    label: "Visits",
    Icon: UtensilsCrossed,
    summary: "Tables and payments",
  },
  // The Prepayments chip, renamed (MESITA-3697).
  vouchers: {
    label: "Vouchers",
    Icon: Ticket,
    summary: "Credits you bought",
  },
  gifts: { label: "Gifts", Icon: Gift, summary: "Sent and received" },
  // The guest's events (MESITA-3716): reservation updates, credit ready.
  notifications: {
    label: "Notifications",
    Icon: Bell,
    summary: "Bookings and updates",
  },
};

export const ACTIVITY_CHIPS: readonly ActivityChip[] = ACTIVITY_TYPES.map(
  (type) => ({ type, ...CHIPS[type] }),
);
