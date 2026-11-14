import { Gift, Inbox, Share2 } from "lucide-react";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// WALLET'S THREE DOORS (Pato, 2026-11-14, MESITA-3894: "Share Mesita / Send
// Credits (Gift) / Redeem Credits (the redeem button at the bottom is
// wrong)"):
//
//   [ Share Mesita ] [ Send Credits ] [ Redeem Credits ]   one row, 64px
//
// Share Mesita opens /share, the card of channel rows. Send Credits opens
// Me › Gift, the places you hold credit at (it read "Gift Credits"). Redeem
// Credits opens the Redeem a code sheet, which was the "Gift code" row at the
// bottom of the Credits list until this. The House Card's action shape
// (MESITA-3868): the icon over a one-line label, so three fit a 320px phone.
// Mesita's own actions, so they wear the brand pink (MESITA-3802): Share
// filled, the other two light. They were two 56px buttons side by side
// (MESITA-3890), and a 120px Share block before that (MESITA-3886).

const BUTTON =
  "flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold whitespace-nowrap transition active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink-300)] focus-visible:ring-offset-2";

const FILLED = `${BUTTON} bg-[var(--brand-pink-600)] text-white hover:opacity-90`;

const LIGHT = `${BUTTON} border border-[var(--brand-pink-200)] bg-[var(--brand-pink-50)] hover:bg-[var(--brand-pink-100)]`;

/** The pink ink by style: an arbitrary `text-[…]` reads as a size to the
 *  type-scale lint. */
const LIGHT_INK = { color: "var(--brand-pink-700)" } as const;

const GLYPH = "h-5 w-5 shrink-0";

/** The row. `onRedeem` opens the code sheet; without it (the loading frame)
 *  Redeem Credits draws but does nothing yet. */
export function WalletShareGift({ onRedeem }: { onRedeem?: () => void }) {
  return (
    <div className="mt-5 flex gap-2" data-wallet-share-gift>
      <PushLink href={CONSUMER_ROUTES.share} className={FILLED} data-wallet-share>
        <Share2 className={GLYPH} strokeWidth={2.25} aria-hidden />
        Share Mesita
      </PushLink>
      <PushLink
        href={CONSUMER_ROUTES.mePages.gift}
        className={LIGHT}
        style={LIGHT_INK}
        data-wallet-send
      >
        <Gift className={GLYPH} strokeWidth={2.25} aria-hidden />
        Send Credits
      </PushLink>
      <button
        type="button"
        onClick={onRedeem}
        className={LIGHT}
        style={LIGHT_INK}
        data-wallet-redeem
      >
        <Inbox className={GLYPH} strokeWidth={2.25} aria-hidden />
        Redeem Credits
      </button>
    </div>
  );
}
