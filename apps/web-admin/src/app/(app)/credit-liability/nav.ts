import { Landmark } from "lucide-react";

// One sidebar entry — "Credits Liability" (MESITA-1679). It KEEPS the
// qualifier even though the collision that first earned it is gone: the
// Configurations row that used to read "Credits" reads "Payments" since
// MESITA-1854. Bare "Credits" here would name the money; this page is not the
// money but the live exposure the policy produces — issued value, outstanding
// balance, pending lots, per-org exposure, breakage to date — plus the
// refund/cancel/adjust action support needs on it. "Liability" is the word
// that says a row is READ, not tuned.
//
// A report an operator MONITORS (same shape as Global Monitor), not a blob an
// operator TUNES — so never a Configurations row. The Alerts group that held
// it is off the rail for now (Pato, MESITA-2114); the page still routes.
export const CREDIT_LIABILITY_PARENT = {
  href: "/credit-liability",
  label: "Credits Liability",
  Icon: Landmark,
} as const;
