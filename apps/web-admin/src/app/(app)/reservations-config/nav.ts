import { CalendarCheck } from "lucide-react";

// One sidebar entry — "Reservations Config". Governs how each place's single
// reservation endpoint is chosen. A single flat page, no sub-tabs.
export const RESERVATIONS_PARENT = {
  href: "/reservations-config",
  label: "Reservations Config",
  Icon: CalendarCheck,
} as const;
