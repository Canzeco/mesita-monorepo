import type { MouseEvent, ReactNode } from "react";

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
  /** The Rewards sheet's Buy (MESITA-3303; a tab until MESITA-3412): opens Stripe Checkout on the
   *  place's account. Absent, the button is inert (admin's preview). */
  onBuyVoucher?: (key: VoucherKey) => void;
  /** The voucher whose Checkout is opening; its button reads Opening…. */
  buyingVoucher?: VoucherKey | null;
  /** The Rewards sheet opened: the host refreshes `place.money` (the offer and
   *  the guest's credit) from consumer-web-list-vouchers. */
  onLoadVouchers?: () => void;
  /** The host's list-vouchers read has not answered yet (MESITA-3388): the
   *  Rewards rows keep their colour and show a bone where Buy goes. */
  vouchersLoading?: boolean;
  /** The Social tab's body (MESITA-3417): this place's activity, read and
   *  drawn by the host; called only while the tab is open. Absent (admin's
   *  Preview, a Google-only card), the tab shows an empty screen. */
  renderSocial?: () => ReactNode;
  /** Prepay and Pay (MESITA-3412): open the host's Rewards sheet at that
   *  section. Absent, both tiles are inert (admin's preview). */
  onOpenRewards?: (section: RewardsSection) => void;
  /** The Cashback card's Pay (MESITA-3352): opens the host's Pay page.
   *  Absent, the card draws no button (admin's preview). */
  onPay?: () => void;
  /** The pinned row's Wallet tile (MESITA-3574): opens the host's Wallet at
   *  this place's credit. Absent (admin's preview, business), the tile is
   *  inert. Its pill reads `place.money.balance`. */
  onOpenWallet?: () => void;
  /** The Wallet tile's Off sheet (MESITA-3583): this place's House Card is
   *  already in the guest's Wallet (pinned or holding credit), from the
   *  host's list-vouchers read. Absent: unknown, the sheet offers to add it. */
  houseCardInWallet?: boolean;
  /** "Add card to Wallet" (MESITA-3583): pins this place's House Card with
   *  $0 (consumer-web-add-house-card). Resolves true once it is in the
   *  Wallet. Absent (admin's preview, business): the sheet has no button. */
  onAddHouseCard?: () => Promise<boolean>;
  /** The guest's own facts for the Offers (i) status (MESITA-3502): VIP needs
   *  the VIP Class, Story a linked Instagram. Absent (signed out, admin's
   *  preview, profile not read yet), no guest lock is drawn. */
  /** instagramFollowers (MESITA-3507): Story needs more than STORY_MIN_FOLLOWERS; absent reads as unknown, no lock. */
  guest?: { vip: boolean; instagramLinked: boolean; instagramFollowers?: number | null };
  /** Request VIP in the VIP (i): the host's VIP Class page. */
  onJoinVip?: () => void;
  /** Link Instagram in the Story (i): the host's Instagram page. */
  onLinkInstagram?: () => void;
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

/** The sections of the Rewards page (MESITA-3412): Pay opens at
 *  `payment`, Prepay at `prepayment`; the Home offer button's Welcome, Story
 *  and VIP slides open at `special` (MESITA-3467). */
export type RewardsSection = "payment" | "prepayment" | "special";
