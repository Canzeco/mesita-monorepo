import { CalendarCheck } from "lucide-react";

// Reservations Config — a single page since the Playground was retired
// (2026-07-27): the Reservationist knobs (test number, channel policy) plus the
// read-only workflow diagram. Testing happens end-to-end from the consumer app
// with test mode ON. RESERVATIONS_PARENT is the Sidebar entry.
export const RESERVATIONS_PARENT = {
  href: "/reservations-config",
  label: "Reservations Config",
  Icon: CalendarCheck,
} as const;
