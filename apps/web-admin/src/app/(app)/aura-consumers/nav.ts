import { UsersRound } from "lucide-react";

// The consumer half of the Manage section, alongside Manage Multiple Units and
// Manage Single Unit. The label is deliberately generic — this is where the
// console manages consumers in bulk — while the page itself is today the one
// roster an operator can actually edit by hand: the invite-only Aura class
// (segments v6, MESITA-797). Every other class is earned, not granted.
export const AURA_CONSUMERS_PARENT = {
  href: "/aura-consumers",
  label: "Manage Multiple Consumers",
  Icon: UsersRound,
} as const;
