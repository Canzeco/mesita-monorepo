import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export type PayTab = "qr" | "tickets" | "balance";

export const PAY_TABS: readonly PayTab[] = ["qr", "tickets", "balance"];

const TAB_PATHS: Record<PayTab, string> = {
  qr: CONSUMER_ROUTES.pay.qr,
  tickets: CONSUMER_ROUTES.pay.tickets,
  balance: CONSUMER_ROUTES.pay.balance,
};

/** Canonical href for a Pay tab. */
export function payTabHref(tab: PayTab): string {
  return TAB_PATHS[tab];
}

/** Parse dynamic /pay/[tab] segment (incl. legacy `wallet`). */
export function payTabFromSegment(segment: string | undefined): PayTab | null {
  if (!segment) return null;
  if (segment === "wallet") return "balance";
  return PAY_TABS.includes(segment as PayTab) ? (segment as PayTab) : null;
}

/** Resolve active tab from the current pathname (incl. legacy /pay/wallet). */
export function payTabFromPathname(pathname: string): PayTab {
  if (pathname.startsWith("/pay/tickets") || pathname.startsWith("/pay/ticket")) {
    return "tickets";
  }
  if (
    pathname.startsWith("/pay/balance") ||
    pathname.startsWith("/pay/wallet")
  ) {
    return "balance";
  }
  return "qr";
}

export function isPayPath(pathname: string): boolean {
  return pathname === "/pay" || pathname.startsWith("/pay/");
}
