import { CurrencyCircleDollarIcon } from "@phosphor-icons/react/dist/ssr";

// Manage › Money (MESITA-3307): the voucher pause switch, the needs_review
// list with its Re-read, one refund and a place's close-out. Last in Manage:
// it acts on records (purchases, payments), never a policy blob.
export const MONEY_PARENT = {
  href: "/money",
  label: "Money",
  Icon: CurrencyCircleDollarIcon,
} as const;
