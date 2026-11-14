import { CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr";

// Manage › Reservations (MESITA-3960, Pato: "in Manage add Reservation to view
// all the reservation tickets"): every reservation ticket, newest first,
// read-only. A record of real things, so it sits in Manage; the policy lives
// on Configurations › Reservations (/reservations-config).
export const MANAGE_RESERVATIONS_PARENT = {
  href: "/manage-reservations",
  label: "Reservations",
  Icon: CalendarCheckIcon,
} as const;
