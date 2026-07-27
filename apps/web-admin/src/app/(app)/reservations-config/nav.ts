import type { LucideIcon } from "lucide-react";
import { CalendarCheck, FlaskConical, Settings2 } from "lucide-react";

// Reservations Config — two sub-tabs. "Config" tunes the Reservationist (test
// numbers, retries, booking channel); "Playground" emulates fake-user intents
// against real DB places/consumers, places real calls, and keeps its tickets in
// the ONE reservations table (runs land there flagged is_test — the sandbox
// is retired). RESERVATIONS_PARENT is the single
// Sidebar entry; RESERVATIONS_SUBROUTES are the in-page tabs (never added to
// the Sidebar).
export const RESERVATIONS_PARENT = {
  href: "/reservations-config",
  label: "Reservations Config",
  Icon: CalendarCheck,
} as const;

export const RESERVATIONS_SUBROUTES = [
  { href: "/reservations-config/config", label: "Config", Icon: Settings2 },
  {
    href: "/reservations-config/playground",
    label: "Playground",
    Icon: FlaskConical,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
