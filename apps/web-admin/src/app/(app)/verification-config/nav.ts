import { BadgeCheck } from "lucide-react";

// Verification lives on Intake (MESITA-1788). /verification-config redirects
// to /enricher-config#s-verification. Distinct from the Alerts Verification
// Queue (manual review of claims). Video auto-verify is gone (MESITA-1248).
export const VERIFICATION_PARENT = {
  href: "/verification-config",
  label: "Verification",
  Icon: BadgeCheck,
} as const;
