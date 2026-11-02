import { WalletPage } from "@/components/consumer/wallet/WalletPage";

// Pay — the Wallet (Pato, 2026-11-01: "build again the wallet page to pay.
// Wallet is for prepayments"; MESITA-3098). It replaces the Soon page that
// MESITA-2087 left here: every balance the guest prepaid, one per place.
// Stripe Checkout comes back here (`?prepay=`).
export default function PayPage() {
  return <WalletPage />;
}
