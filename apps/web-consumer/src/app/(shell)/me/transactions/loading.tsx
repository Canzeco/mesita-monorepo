import { MeScreen } from "@/components/consumer/me/MeScreen";
import { WalletSkeleton } from "@/components/consumer/wallet/WalletPage";

// /me/transactions' fallback: its own frame over the Wallet's row bones, the
// shape the list lands in (MESITA-2701).
export default function TransactionsLoading() {
  return (
    <MeScreen title="Transactions">
      <WalletSkeleton />
      <p role="status" className="sr-only">
        Loading transactions
      </p>
    </MeScreen>
  );
}
