import { PulseIcon } from "@phosphor-icons/react/dist/ssr";

// Ping — Extra's probe. The route stays /billing-test (MESITA-4518): a label
// rename does not rename the route. One Run checks each paid API on its own.
export const BILLING_TEST_PARENT = {
  href: "/billing-test",
  label: "Ping",
  Icon: PulseIcon,
} as const;
