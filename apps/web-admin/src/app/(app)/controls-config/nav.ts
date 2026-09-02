import { Coins } from "lucide-react";

// One sidebar entry — "Credits" (Pato, 2026-09-02). The Wallet's Credits
// policy: how long a prepaid balance is held before a guest can spend it, what
// the place pays for that hold, and how long the Credits live before expiring.
//
// THE RENAME STOPS AT THE LABEL, as every rename on this rail does. The route
// stays `/controls-config`, the blob stays `app_config.controls_config`, the
// endpoints stay `admin-web-get/update-controls-config`, and this constant
// stays `CONTROLS_PARENT` — a rename that reaches a URL, a column or an EF name
// is the bug the frozen-directory rule exists to prevent. `FILTERS_PARENT`
// labelled "Discovery" is the same shape one row up; do not "fix" either.
//
// NOT the Single Place tab also called Controls (`/promos`, four tabs: Profile ·
// Controls · Activity · Admin). That one configures ONE place and keeps its
// name; this one is platform policy. Two rows, two scopes, and only this one
// moved.
//
// "CREDITS" NAMES THE DOMAIN, NOT A CONTAINER. Vocabulary bans Credits as a
// container name — that is why the consumer section is Wallet, which holds
// Credits AND saved cards AND gifting, three unlike things. This page is not
// that: every box on it, the terms and the parked Gifting one, is about Credits
// and nothing else. Naming it for its one subject is the opposite of the
// collision the Wallet split prevents.
//
// LAST in Configurations, after Rewards. Every row above it configures an ENGINE
// that runs a guest journey; this one configures the INSTRUMENT the journey
// leaves behind, which only exists once one of them has run.
//
// Whether Credits may settle a bill at all is not here — that is
// `visits_config.payCredits` on the Visits page, a different question (which
// rails are open) for a different engine.
export const CONTROLS_PARENT = {
  href: "/controls-config",
  label: "Credits",
  // Sliders drew the old name. Every other rail glyph names its subject, and
  // `Coins` is unused elsewhere in the sidebar, so the row still reads
  // distinctly at a glance.
  Icon: Coins,
} as const;
