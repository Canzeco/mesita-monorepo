import type { MouseEvent } from "react";

import type { PlaceDetail, VoucherKey } from "./place-detail";

export type PlaceMenuItem = PlaceDetail["products"]["menu"][number];

/** The profile is on screen before Mesita holds it — a Google-only card the
 *  guest opened (MESITA-2307). While the create runs a Creating fact leads
 *  the facts row (MESITA-2679); a refusal says why at the top of Overview. */
export type PlaceCreatingView = {
  error: string | null;
  /** Runs the create again after a refusal; absent, the panel only says why. */
  onRetry?: () => void;
};

/** Optional member actions. A missing callback renders the control and does
 *  not run it. The consumer passes the live ones; admin passes none. */
export type PlaceActions = {
  onSave?: () => void;
  saved?: boolean;
  onContact?: () => void;
  onShare?: () => void;
  /** The top bar's three dots: a menu of the place's actions, Report last
   *  (MESITA-2692; they opened Report alone, MESITA-2684). */
  onMore?: () => void;
  onReserve?: () => void;
  /** The fifth tile, Upgrade (MESITA-3200): opens the host's sheet (MESITA-3201). */
  onBoost?: () => void;
  onOpenMenu?: (menu: PlaceMenuItem) => void;
  onOpenLink?: (url: string) => void;
  /** The Vouchers tab's Buy (MESITA-3303): opens Stripe Checkout on the
   *  place's account. Absent, the button is inert (admin's preview). */
  onBuyVoucher?: (key: VoucherKey) => void;
  /** The voucher whose Checkout is opening; its button reads Opening…. */
  buyingVoucher?: VoucherKey | null;
  /** The Vouchers tab opened: the host refreshes `place.money` (the offer and
   *  the guest's credit) from consumer-web-list-vouchers. */
  onLoadVouchers?: () => void;
  /** The Cashback card's Pay (MESITA-3352): opens the host's Pay page.
   *  Absent, the card draws no button (admin's preview). */
  onPay?: () => void;
};

export function inertButtonProps(live: boolean): {
  tabIndex?: -1;
  "aria-disabled"?: true;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
} {
  if (live) return {};
  return {
    tabIndex: -1,
    "aria-disabled": true,
    onClick: (event) => event.preventDefault(),
  };
}
