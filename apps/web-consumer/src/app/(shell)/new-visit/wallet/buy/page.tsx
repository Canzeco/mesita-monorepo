import { BuyClient } from "./BuyClient";
import { parseCreditsDemo } from "@/lib/credits-demo";

// /new-visit/wallet/buy — Buy Credits, a full page (Pato, 2026-09-08).
//
// It was a `LocalSheet` on the wallet until today. See newVisit.walletBuy in
// the route contract for why every one of Wallet's four children is a route
// now, and WalletScreen for what "full-screen" means inside a shell that keeps
// its tab bar.
//
// The seed is read SERVER-side and handed down, exactly as wallet/page.tsx
// does: a client useSearchParams() here would need its own <Suspense> or it
// de-opts the route and fails `next build`. No `export const dynamic` — the
// Pay layout forces the whole segment dynamic.

export default async function BuyCreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <BuyClient seed={parseCreditsDemo(sp)} />;
}
