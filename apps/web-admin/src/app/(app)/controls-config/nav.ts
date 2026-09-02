import { SlidersHorizontal } from "lucide-react";

// One sidebar entry — "Controls". The Wallet's Credits policy: how long a
// prepaid balance is held before a guest can spend it, and what the place pays
// for that hold.
//
// LAST in Configurations, after Promos. Every row above it configures an ENGINE
// that runs a guest journey; this one configures the INSTRUMENT the journey
// leaves behind, which only exists once one of them has run.
//
// Whether Credits may settle a bill at all is not here — that is
// `visits_config.payCredits` on the Visits page, a different question (which
// rails are open) for a different engine.
export const CONTROLS_PARENT = {
  href: "/controls-config",
  label: "Controls",
  Icon: SlidersHorizontal,
} as const;
