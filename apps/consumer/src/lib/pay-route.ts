import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export type PayTab = "qr" | "tickets";

export const PAY_TABS: readonly PayTab[] = ["qr", "tickets"];

const TAB_PATHS: Record<PayTab, string> = {
  qr: CONSUMER_ROUTES.pay.qr,
  tickets: CONSUMER_ROUTES.pay.tickets,
};

/** Canonical href for a QR tab. */
export function payTabHref(tab: PayTab): string {
  return TAB_PATHS[tab];
}

/** Parse dynamic /pay/[tab] segment (incl. legacy `wallet` / `balance`). */
export function payTabFromSegment(segment: string | undefined): PayTab | null {
  if (!segment) return null;
  // The wallet is gone — legacy balance/wallet links land on QR.
  if (segment === "wallet" || segment === "balance") return "qr";
  return PAY_TABS.includes(segment as PayTab) ? (segment as PayTab) : null;
}

/** Resolve active tab from the current pathname (incl. legacy /pay/wallet). */
export function payTabFromPathname(pathname: string): PayTab {
  if (
    pathname.startsWith("/pay/tickets") ||
    pathname.startsWith("/pay/ticket")
  ) {
    return "tickets";
  }
  return "qr";
}

export function isPayPath(pathname: string): boolean {
  return pathname === "/pay" || pathname.startsWith("/pay/");
}
