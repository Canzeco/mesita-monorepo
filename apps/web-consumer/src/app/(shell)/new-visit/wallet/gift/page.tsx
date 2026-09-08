import { GiftClient } from "./GiftClient";

// /new-visit/wallet/gift — buy Credits for someone else (MESITA-1677).
//
// GIFTING IS ISSUANCE, NOT TRANSFER, and that is why this route exists at all:
// you buy a NEW balance for someone, you never move money out of one you hold.
// Transfer would have to split a lot — a second lot, a re-derived bonus rate, a
// re-derived expiry — which MESITA-1380 banned. So gifting starts exactly where
// buying starts, by choosing a place, which is also why Gift is a GLOBAL button
// in the wallet header rather than an action on one balance card.
//
// REAL AS OF MESITA-1677: this is wired to consumer-web-gift-credits instead
// of the browser emulator, so there is no demo seed to read server-side any
// more — GiftClient loads its own policy, place list, and sent-gifts list
// client-side, exactly like buy/page.tsx did for MESITA-1676.

export default function GiftCreditsPage() {
  return <GiftClient />;
}
