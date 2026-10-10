import { Activity } from "lucide-react";

// Billing Test — the first page under the "Testing" sidebar section. It probes
// each paid third-party API in isolation (auth still valid? balance left?) so a
// vendor outage can be attributed to a vendor instead of guessed at from a
// degraded pipeline. TESTING_PARENT is the Sidebar entry.
export const BILLING_TEST_PARENT = {
  href: "/billing-test",
  label: "Billing",
  Icon: Activity,
} as const;
