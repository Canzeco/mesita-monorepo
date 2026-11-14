import { Gift, Share2 } from "lucide-react";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// WALLET'S TWO DOORS, SIDE BY SIDE (Pato, 2026-11-14, MESITA-3890: "share
// mesita left gift credits right. not thatttt fucking big"):
//
//   [ Share Mesita ] [ Gift Credits ]   one row, two equal halves, 56px
//
// Share opens /share, the card of channel rows; Gift opens Me › Gift, the
// places you hold credit at. Both read nothing, so the page and its loading
// frame draw them at once, in every state of the lists. Mesita's own actions,
// so they wear the brand pink (MESITA-3802): Share filled, Gift light. They
// were a 120px Share block over a 52px Gift button for a release (MESITA-3886).

const BUTTON =
  "flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink-300)] focus-visible:ring-offset-2";

const SHARE = `${BUTTON} bg-[var(--brand-pink-600)] text-white hover:opacity-90`;

const GIFT = `${BUTTON} border border-[var(--brand-pink-200)] bg-[var(--brand-pink-50)] hover:bg-[var(--brand-pink-100)]`;

export function WalletShareGift() {
  return (
    <div className="mt-5 flex gap-3" data-wallet-share-gift>
      <PushLink href={CONSUMER_ROUTES.share} className={SHARE} data-wallet-share>
        <Share2 className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
        Share Mesita
      </PushLink>
      <PushLink
        href={CONSUMER_ROUTES.mePages.gift}
        className={GIFT}
        // The pink ink by style: an arbitrary `text-[…]` reads as a size to
        // the type-scale lint.
        style={{ color: "var(--brand-pink-700)" }}
        data-wallet-gift
      >
        <Gift className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
        Gift Credits
      </PushLink>
    </div>
  );
}
