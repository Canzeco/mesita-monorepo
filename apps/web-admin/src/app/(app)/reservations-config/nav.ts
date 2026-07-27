import type { LucideIcon } from "lucide-react";
import { CalendarCheck, FlaskConical, Settings2 } from "lucide-react";

// Reservations Config — two sub-tabs. "Config" tunes the Reservationist (test
// number, retries, booking channel); "Playground" exercises it in two modes —
// Fake user (places a real call to the test number) and Actual user (real
// reservation flow, soon). RESERVATIONS_PARENT is the single Sidebar entry;
// RESERVATIONS_SUBROUTES are the in-page tabs (never added to the Sidebar).
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
