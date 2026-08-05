import { BadgeCheck } from "lucide-react";

// One sidebar entry — "Verification Config". A single flat page. Controls
// whether newly created places land as Verified Partner (listing_type=
// partner) without phone ownership proof. Distinct from the Alerts
// Verification Queue (ownership OTP / video claims).
export const VERIFICATION_PARENT = {
  href: "/verification-config",
  label: "Verification Config",
  Icon: BadgeCheck,
} as const;
