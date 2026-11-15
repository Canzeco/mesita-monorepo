import { CreditCard, Gift, HandCoins, Share2 } from "lucide-react";

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
// The three Credits buttons share one colour, the app's own black primary
// (MESITA-4032, Pato: "Credits of one color, share of other color"); Share
// Mesita keeps the brand pink.
const CREDITS = `${BUTTON.replace("text-white", "text-paper")} bg-foreground focus-visible:ring-neutral-400`;

const GLYPH = "h-4 w-4 shrink-0";

// BUY CREDITS (Pato, 2026-11-15, MESITA-4031: "add a buy credits button in
// wallet"): the fourth door, so the row is a 2x2 grid of equal buttons (four
// in one row do not fit a 320px phone). Credits are bought at one place, so it
// opens Search, the same way as "Add a Credits Card" below; the place's
// Buy Credits then runs the purchase.
/** The grid: four links, the same in the loading frame. */
export function WalletShareGift() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2" data-wallet-share-gift>
      <PushLink
        href={CONSUMER_ROUTES.search}
        className={CREDITS}
        data-wallet-buy
      >
        <CreditCard className={GLYPH} strokeWidth={2.25} aria-hidden />
        Buy Credits
      </PushLink>
      <PushLink
        href={CONSUMER_ROUTES.mePages.gift}
        className={CREDITS}
        data-wallet-send
      >
        <Gift className={GLYPH} strokeWidth={2.25} aria-hidden />
        Send Credits
      </PushLink>
      {/* Its own page since MESITA-4020; it opened a sheet until then. */}
      <PushLink
        href={CONSUMER_ROUTES.walletRedeem}
        className={CREDITS}
        data-wallet-redeem
      >
        <HandCoins className={GLYPH} strokeWidth={2.25} aria-hidden />
        Redeem Credits
      </PushLink>
      <PushLink href={CONSUMER_ROUTES.share} className={SHARE} data-wallet-share>
        <Share2 className={GLYPH} strokeWidth={2.25} aria-hidden />
        Share Mesita
      </PushLink>
    </div>
  );
}
