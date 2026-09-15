import { Coins } from "lucide-react";

// One sidebar entry — "Payments" (Pato, 2026-09-14: *"rename credits to
// payments its simpler"*). The money page: how long a prepaid balance is held
// before a guest can spend it, what the place pays for that hold, and how long
// the Credits live before expiring.
//
// PAYMENTS, BECAUSE THE OTHER CONSOLE ALREADY SAYS IT. MESITA-1845 merged
// Credits into Payments in the business console a day before this. An operator
// who sets the terms here and reads what happened there should not have to
// learn two words for the same money.
//
// THE RENAME STOPS AT THE LABEL, as every rename on this rail does. The route
// stays `/controls-config`, the blob stays `app_config.controls_config`, the
// wire key stays `section: "controls"`, and this constant
// stays `CONTROLS_PARENT` — a rename that reaches a URL, a column or an EF name
// is the bug the frozen-directory rule exists to prevent. `FILTERS_PARENT`
// labelled "Discovery" is the same shape a few rows up; do not "fix" either.
//
// THE WORD MOVED DOWN A LEVEL; it was not banned from the page. The box that
// holds the terms is called Credits now, which it could not be while the page
// heading read Credits. Do NOT reach for the Wallet argument to justify this:
// Wallet earns the container word because it holds a SECOND INSTRUMENT, the
// guest's saved cards, and this page has none — Gifting is Credits with a
// recipient, as its own subtitle says. Payments is here because Pato asked for
// it and because the other console already says it, which is reason enough.
//
// LAST in Configurations, after Reservations. Every row above it configures an
// ENGINE that runs a guest journey; this one configures the INSTRUMENT the
// journey leaves behind, which only exists once one of them has run.
//
// Whether Credits may settle a bill at all is not here — that is
// `visits_config.payCredits` on the Visits page, a different question (which
// rails are open) for a different engine. What is OUTSTANDING is not here
// either: Alerts › Credits Liability is the report, this is the policy.
export const CONTROLS_PARENT = {
  href: "/controls-config",
  label: "Payments",
  // Coins, not Wallet: the business console's Payments row wears Wallet because
  // that page is the purse. This one is the terms the money runs on, and Coins
  // is unused elsewhere on this rail, so the row still reads distinctly.
  Icon: Coins,
} as const;
