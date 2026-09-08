import { GiftClient } from "./GiftClient";

// /new-visit/wallet/gift — buy Credits for someone else (MESITA-1677).
// PARKED (MESITA-1674): see GiftClient.tsx — the real backend this needs is
// a separate, still-in-flight issue.
//
// GIFTING IS ISSUANCE, NOT TRANSFER, and that is why this route exists at all:
// you buy a NEW balance for someone, you never move money out of one you hold.
// Transfer would have to split a lot — a second lot, a re-derived bonus rate, a
// re-derived expiry — which MESITA-1380 banned. So gifting starts exactly where
// buying starts, by choosing a place, which is also why Gift is a GLOBAL button
// in the wallet header rather than an action on one balance card.

export default function GiftCreditsPage() {
  return <GiftClient />;
}
