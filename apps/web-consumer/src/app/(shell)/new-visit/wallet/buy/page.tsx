import { BuyClient } from "./BuyClient";

// /new-visit/wallet/buy — Buy Credits, a full page (Pato, 2026-09-08).
//
// It was a `LocalSheet` on the wallet until today. See newVisit.walletBuy in
// the route contract for why every one of Wallet's four children is a route
// now, and WalletScreen for what "full-screen" means inside a shell that keeps
// its tab bar.
//
// REAL AS OF MESITA-1676: this is the first Wallet subroute wired to a real
// Edge Function (consumer-web-buy-credits) instead of the browser emulator,
// so there is no demo seed to read server-side any more — BuyClient loads
// its own policy and place list client-side.

export default function BuyCreditsPage() {
  return <BuyClient />;
}
