import { Landmark } from "lucide-react";

// One sidebar entry — "Credits Liability" (MESITA-1679). Deliberately NOT
// labelled bare "Credits": controls-config/nav.ts already claims that word
// for the Credits POLICY page (the hold, the bonus, the expiry knobs), and
// its own comment says "CREDITS NAMES THE DOMAIN, NOT A CONTAINER" — two
// sidebar rows both reading "Credits" would be exactly the collision that
// rule exists to prevent. This page is a different kind of thing: not a
// policy an operator sets, but the live exposure the policy produces —
// issued value, outstanding balance, pending lots, per-org exposure,
// breakage to date — plus the refund/cancel/adjust action support needs on
// it. "Liability" names that directly.
//
// ALERTS, not Configurations: this is a report an operator MONITORS
// (same shape as Global Monitor), not a blob an operator TUNES.
export const CREDIT_LIABILITY_PARENT = {
  href: "/credit-liability",
  label: "Credits Liability",
  Icon: Landmark,
} as const;
