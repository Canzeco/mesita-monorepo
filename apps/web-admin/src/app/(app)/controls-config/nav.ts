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
// endpoints stay `admin-web-get/update-controls-config`, and this constant
// stays `CONTROLS_PARENT` — a rename that reaches a URL, a column or an EF name
// is the bug the frozen-directory rule exists to prevent. `FILTERS_PARENT`
// labelled "Discovery" is the same shape a few rows up; do not "fix" either.
//
// "CREDITS" NAMES THE DOMAIN, NOT A CONTAINER — and that rule is why the word
// came OFF this row. Vocabulary bans Credits as a container name: the consumer
// section is Wallet because it holds Credits AND saved cards AND gifting. This
// page is the same shape, one level down — the wired Credits terms and the
// parked Gifting box are two unlike things — so it takes the container word,
// Payments, and hands "Credits" back to the box that is only about Credits.
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
