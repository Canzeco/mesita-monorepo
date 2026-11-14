import { Gift, Share2 } from "lucide-react";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// WALLET'S TWO BIG DOORS (Pato, 2026-11-14, MESITA-3886: "in wallet include
// the button to share. super big button. Include Gift and include Share"):
//
//   [        Share Mesita        ]   full width, 120px, filled brand pink
//   [        Gift Credits        ]   full width, 52px, light pink
//
// Share is THE big thing on Wallet (Pato picked "Share huge, Gift under"
// over an equal pair); it opens /share, the card of channel rows. Gift opens
// Me › Gift, the places you hold credit at. Both read nothing, so the page
// and its loading frame draw them at once, in every state of the lists.
// Mesita's own actions, so they wear the brand pink (MESITA-3802), never the
// quiet grey of a door out of the app.

const SHARE =
  "flex min-h-[120px] w-full items-center justify-center gap-3 rounded-2xl bg-[var(--brand-pink-600)] px-4 text-xl font-semibold text-white transition hover:opacity-90 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink-300)] focus-visible:ring-offset-2";

const GIFT =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--brand-pink-200)] bg-[var(--brand-pink-50)] px-4 text-base font-semibold transition hover:bg-[var(--brand-pink-100)] active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink-300)] focus-visible:ring-offset-2";

export function WalletShareGift() {
  return (
    <div className="mt-5 flex flex-col gap-3" data-wallet-share-gift>
      <PushLink href={CONSUMER_ROUTES.share} className={SHARE} data-wallet-share>
        <Share2 className="h-7 w-7" strokeWidth={2.25} aria-hidden />
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
        <Gift className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        Gift Credits
      </PushLink>
    </div>
  );
}
