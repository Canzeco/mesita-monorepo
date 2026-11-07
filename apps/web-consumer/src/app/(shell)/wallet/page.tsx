import { WalletPage } from "@/components/consumer/wallet/WalletPage";

// /wallet — the bar's Wallet tab (Pato, MESITA-3295: "Home Search Pay Wallet
// Me"). The balances a guest prepaid, one row per place (MESITA-3098). A
// Mesita Prepay checkout returns here with `?prepay=<session>`; the page's
// read credits it. It lights its tab here, like Pay.
export default function Page() {
  return <WalletPage />;
}
