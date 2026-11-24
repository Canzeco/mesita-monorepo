import { ShieldWarningIcon } from "@phosphor-icons/react/dist/ssr";

// Security › Suspensions (MESITA-4899): the rules on wrong waiter codes, and the
// guests they suspended.
export const SECURITY_PARENT = { href: "/security", label: "Suspensions", Icon: ShieldWarningIcon } as const;
