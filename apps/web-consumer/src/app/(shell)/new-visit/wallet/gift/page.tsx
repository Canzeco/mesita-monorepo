import { GiftClient } from "./GiftClient";
import { parseCreditsDemo } from "@/lib/credits-demo";

// /new-visit/wallet/gift — buy Credits for someone else (MESITA-1677).
//
// GIFTING IS ISSUANCE, NOT TRANSFER, and that is why this route exists at all:
// you buy a NEW balance for someone, you never move money out of one you hold.
// Transfer would have to split a lot — a second lot, a re-derived bonus rate, a
// re-derived expiry — which MESITA-1380 banned. So gifting starts exactly where
// buying starts, by choosing a place, which is also why Gift is a GLOBAL button
// in the wallet header rather than an action on one balance card.
//
// Same server-side seed read as its siblings; see buy/page.tsx.

export default async function GiftCreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <GiftClient seed={parseCreditsDemo(sp)} />;
}
