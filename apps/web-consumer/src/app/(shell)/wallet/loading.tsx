import WalletPage from "./page";

// /wallet's fallback is the page itself, as Pay's is (MESITA-2701): the Soon
// state has no data to stand in for. A file, not a child: Wallet stays one
// page.
export default function WalletLoading() {
  return <WalletPage />;
}
