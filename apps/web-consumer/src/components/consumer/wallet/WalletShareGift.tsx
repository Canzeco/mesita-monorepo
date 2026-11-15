import { CreditCard, Gift, HandCoins, Share2 } from "lucide-react";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { Panel } from "@/components/shared/Panel";

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
// 52px (MESITA-4087, Pato: "make everything shorter in this page"): it was
// 64px; the 16px glyph over a label that may take two tight lines still fits.
const BUTTON =
  "type-body flex h-13 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center leading-tight font-semibold text-white transition hover:opacity-90 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

// SOFT TINTS (MESITA-4054, Pato: "USE BETTER COLOR FOR THE TOP BUTTONS";
// option A of a three-way mock): Buy stays the one solid black button; the
// gift doors and Share are light tints with their own ink and a 1px inset
// ring, so they read as calm secondaries.
const SHARE = `${BUTTON.replace("text-white", "text-pink-700")} bg-pink-50 ring-1 ring-inset ring-pink-200 focus-visible:ring-pink-400`;
// The three Credits buttons share one colour, the app's own black primary
// (MESITA-4032, Pato: "Credits of one color, share of other color"); Share
// Mesita keeps the brand pink.
const CREDITS = `${BUTTON.replace("text-white", "text-paper")} bg-foreground focus-visible:ring-neutral-400`;
// THREE COLOURS AGAIN (MESITA-4045, Pato: "Buy Credits one color, Send and
// Claim other color, Share other color"): Buy black, the two gift doors green, Share pink;
// as soft tints since MESITA-4054.
const GIFT = `${BUTTON.replace("text-white", "text-emerald-800")} bg-emerald-50 ring-1 ring-inset ring-emerald-200 focus-visible:ring-emerald-400`;

const GLYPH = "h-4 w-4 shrink-0";

// BUY CREDITS (Pato, 2026-11-15, MESITA-4031: "add a buy credits button in
// wallet"): the fourth door. The row is ONE row of four equal buttons (MESITA-4034,
// Pato: "not 2 and 2 but 4 in same row"; MESITA-4032 had made it a 2x2 grid):
// the label may wrap to two lines under its icon so four fit a phone. Credits are bought at one place, so it
// opens Search, the same way as "Add a Credits Card" below; the place's
// Buy Credits then runs the purchase.
/** The row: four links, the same in the loading frame. */
export function WalletShareGift() {
  return (
    <Panel className="mt-4 grid grid-cols-4 gap-2 p-4" data-wallet-share-gift>
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
        className={GIFT}
        data-wallet-send
      >
        <Gift className={GLYPH} strokeWidth={2.25} aria-hidden />
        Send Gift
      </PushLink>
      {/* Its own page since MESITA-4020; it opened a sheet until then.
          Claim Gift, not Redeem Credits (MESITA-4045, Pato: "less
          transactional than redeem credits"). */}
      <PushLink
        href={CONSUMER_ROUTES.walletRedeem}
        className={GIFT}
        data-wallet-redeem
      >
        <HandCoins className={GLYPH} strokeWidth={2.25} aria-hidden />
        Claim Gift
      </PushLink>
      <PushLink
        href={CONSUMER_ROUTES.share}
        className={SHARE}
        data-wallet-share
      >
        <Share2 className={GLYPH} strokeWidth={2.25} aria-hidden />
        Share Mesita
      </PushLink>
    </Panel>
  );
}
