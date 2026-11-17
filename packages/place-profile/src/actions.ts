import type { MouseEvent, ReactNode } from "react";

import type { PlaceDetail, VoucherKey } from "./place-detail";
import type { PayCards } from "./pay-cards";

export type PlaceMenuItem = PlaceDetail["products"]["menu"][number];

/** One line of the Offers page's basket (MESITA-3841): a voucher and how many. */
export type VoucherBasketItem = { voucher: VoucherKey; qty: number };
/** How a voucher buy ended (MESITA-4224): the pay sheet turns into a receipt
 *  on "paid" or "processing" and stays open to try again on "failed" (the
 *  host already said why). */
export type VoucherBuyOutcome = "paid" | "processing" | "failed";

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
  /** The guest's live reservation here (MESITA-3640): a guest holds at most
   *  one per place, drawn as one full-width button under Reserve · Prepay ·
   *  Wallet · Pay. `when` ("Fri 13 Nov · 21:00") and `status` ("Confirmed",
   *  "Booking…") are the host's words; green once confirmed, grey before.
   *  Absent or null: no button. */
  reservation?: { when: string; status: string; confirmed: boolean; onOpen: () => void } | null;
  /** The fifth tile, Upgrade (MESITA-3200): opens the host's sheet (MESITA-3201). */
  onBoost?: () => void;
  onOpenMenu?: (menu: PlaceMenuItem) => void;
  onOpenLink?: (url: string) => void;
  /** The Offers page's Pay (MESITA-3303; a basket since MESITA-3841; in the
   *  page since MESITA-4065): pays the guest's selection with the card the
   *  page drew as selected, one charge for all, on the place's account. No
   *  second sheet. `cardId` null: no usable card, the host opens its card
   *  sheet. Absent, the button is inert (admin's preview). Resolves with how
   *  it ended (MESITA-4224); a host that returns nothing leaves the sheet open. */
  onBuyVoucher?: (items: VoucherBasketItem[], cardId: string | null) => void | Promise<VoucherBuyOutcome>;
  /** A voucher of the basket being paid; while set the button reads Paying…
   *  and the card rows and steppers are locked. */
  buyingVoucher?: VoucherKey | null;
  /** The guest's saved cards for the Offers page's "Pay with" (MESITA-4065).
   *  Absent: signed out or a host with no cards; no "Pay with" is drawn. */
  payCards?: PayCards;
  /** The card a Pay charges (the host remembers the last one used). */
  payCardId?: string | null;
  onSelectPayCard?: (id: string) => void;
  /** "Add a card": the host's in-app card sheet (no Stripe page). */
  onAddPayCard?: () => void;
  /** Retry after the card list failed to load. */
  onRetryPayCards?: () => void;
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
  /** The Offers tile's voucher slides (MESITA-3412, MESITA-4151): open the
   *  host's Offers page at a section. Absent, the tile is inert (admin's preview). */
  onOpenRewards?: (section: RewardsSection) => void;
  /** The Offers tile's Pay slide (MESITA-3352, MESITA-4151): opens the
   *  host's Pay page. Absent, that slide is inert (admin's preview). */
  onPay?: () => void;
  /** The guest's own facts for the Offers (i) status (MESITA-3502): VIP needs
   *  the VIP Class, Story a linked Instagram. Absent (signed out, admin's
   *  preview, profile not read yet), no guest lock is drawn. */
  /** instagramFollowers (MESITA-3507): Story needs more than STORY_MIN_FOLLOWERS; absent reads as unknown, no lock. */
  guest?: { vip: boolean; instagramLinked: boolean; instagramFollowers?: number | null };
  /** The voucher a Home offer chip asked for (MESITA-4207, `?voucher=`):
   *  the Offers page opens with it ticked when this guest can buy it. */
  askedVoucher?: string | null;
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

/** Why the Offers sheet opened (MESITA-3412): Prepay and the Wallet at
 *  `prepayment`, the Home offer button's Welcome, Story and VIP slides at
 *  `special` (MESITA-3467). Both show the same one section; "payment" went
 *  with the Payments card (MESITA-4062). */
export type RewardsSection = "prepayment" | "special";
