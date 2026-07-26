import type { LucideIcon } from "lucide-react";
import { Filter, FlaskConical, Settings2 } from "lucide-react";

// Sourcing Config — two sub-tabs. "Config" tunes the per-channel eligibility
// policy; "Playground" tests a candidate place against every channel. Governs
// which Google places are eligible to enter Mesita, per sourcing channel.
// SOURCING_PARENT is the single Sidebar entry; SOURCING_SUBROUTES are the in-page
// tabs (never added to the Sidebar).
export const SOURCING_PARENT = {
  href: "/sourcing-config",
  label: "Sourcing Config",
  Icon: Filter,
} as const;

export const SOURCING_SUBROUTES = [
  { href: "/sourcing-config/config", label: "Config", Icon: Settings2 },
  {
    href: "/sourcing-config/playground",
    label: "Playground",
    Icon: FlaskConical,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
