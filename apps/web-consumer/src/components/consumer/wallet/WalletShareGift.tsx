import { Gift, HandCoins, Share2 } from "lucide-react";

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
// Mesita's own actions, in colour (MESITA-3802); since MESITA-3901 each its own:
// pink, blue, green. They were two 56px buttons side by side
// (MESITA-3890), and a 120px Share block before that (MESITA-3886).

// THREE COLOURS, SHORTER (Pato, MESITA-3901: "three different colors for top
// three different buttons and make them shorter too"): each solid with white
// ink, from the app's own set: brand pink, the selector blue, the Cash
// green's family. 52px (was 64px), the glyph 16px over a 13px label, so three
// still fit a 320px phone.
const BUTTON =
  "type-body flex h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 font-semibold whitespace-nowrap text-white transition hover:opacity-90 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const SHARE = `${BUTTON} bg-[var(--brand-pink-600)] focus-visible:ring-[var(--brand-pink-300)]`;
const SEND = `${BUTTON} bg-blue-600 focus-visible:ring-blue-300`;
const REDEEM = `${BUTTON} bg-emerald-600 focus-visible:ring-emerald-300`;

const GLYPH = "h-4 w-4 shrink-0";

/** The row. `onRedeem` opens the code sheet; without it (the loading frame)
 *  Redeem Credits draws but does nothing yet. */
export function WalletShareGift({ onRedeem }: { onRedeem?: () => void }) {
  return (
    <div className="mt-5 flex gap-2" data-wallet-share-gift>
      <PushLink href={CONSUMER_ROUTES.share} className={SHARE} data-wallet-share>
        <Share2 className={GLYPH} strokeWidth={2.25} aria-hidden />
        Share Mesita
      </PushLink>
      <PushLink
        href={CONSUMER_ROUTES.mePages.gift}
        className={SEND}
        data-wallet-send
      >
        <Gift className={GLYPH} strokeWidth={2.25} aria-hidden />
        Send Credits
      </PushLink>
      <button
        type="button"
        onClick={onRedeem}
        className={REDEEM}
        data-wallet-redeem
      >
        <HandCoins className={GLYPH} strokeWidth={2.25} aria-hidden />
        Redeem Credits
      </button>
    </div>
  );
}
