
import { Gift, Share2 } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DOOR_GLYPH, DOOR_QUIET } from "./wallet-buttons";

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

// The classes live in wallet-buttons.ts (DOOR_*) since MESITA-4095: the House
// Card wears the same four. History of the colours and sizes: MESITA-3901
// (three colours, shorter), MESITA-4032/4045 (Buy black, gifts green, Share
// pink), MESITA-4054 (soft tints), MESITA-4087 (52px).

// BUY CREDITS (Pato, 2026-11-15, MESITA-4031: "add a buy credits button in
// wallet"): the fourth door. The row is ONE row of four equal buttons (MESITA-4034,
// Pato: "not 2 and 2 but 4 in same row"; MESITA-4032 had made it a 2x2 grid):
// the label may wrap to two lines under its icon so four fit a phone.
// PICK A PLACE FIRST (MESITA-4096, Pato: "buy credits and send credits must
// actually display a list of places to select the action"): Buy Credits opens
// /wallet/buy (the places that sell credits, a row opens its prepay page);
// Send Gift opens /wallet/send (the House Cards, a row opens its send page).
// Claim Gift stays the one code page: a code works at any place.
// GREY, NO BOX (MESITA-4232): the three sit on the page under Pay Bill, one
// soft grey with black ink; the panel around them and the black / green /
// pink tints are gone.
/** The row: two links, the same in the loading frame. TWO DOORS SINCE
 *  MESITA-4269 (Pato: "remove the button to buy credits from there. just
 *  leave Pay Bill, Send Gift, Share Mesita"; Buy Credits lives on each House
 *  Card). ONE ICON LANGUAGE (MESITA-4272, Pato: "either emojis or both or
 *  none. you can use icons too"): both wear line glyphs, Gift and Share2,
 *  like the Pay Bill QR and the place screen's tiles; the 🎁 is gone. */
export function WalletShareGift() {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2" data-wallet-share-gift>
      <PushLink
        href={CONSUMER_ROUTES.walletSend}
        className={DOOR_QUIET}
        data-wallet-send
      >
        <Gift className={DOOR_GLYPH} strokeWidth={2.25} aria-hidden />
        Send Gift
      </PushLink>
      <PushLink
        href={CONSUMER_ROUTES.share}
        className={DOOR_QUIET}
        data-wallet-share
      >
        <Share2 className={DOOR_GLYPH} strokeWidth={2.25} aria-hidden />
        Share Mesita
      </PushLink>
    </div>
  );
}
