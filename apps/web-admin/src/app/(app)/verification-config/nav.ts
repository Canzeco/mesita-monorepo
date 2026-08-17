import { BadgeCheck } from "lucide-react";

// One sidebar entry — "Verification Config". A single flat page for every
// verification policy: create-as-Verified-Partner badge + ownership
// auto-confirm (phone / email / video). Distinct from the Alerts
// Verification Queue (manual review of claims).
export const VERIFICATION_PARENT = {
  href: "/verification-config",
  label: "Verification",
  Icon: BadgeCheck,
} as const;
