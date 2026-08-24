import { BadgeCheck } from "lucide-react";

// Folded into General (MESITA-1175). Distinct from the Alerts Verification
// Queue (manual review of claims). Video auto-verify is gone (MESITA-1248).
export const VERIFICATION_PARENT = {
  href: "/verification-config",
  label: "Verification",
  Icon: BadgeCheck,
} as const;
