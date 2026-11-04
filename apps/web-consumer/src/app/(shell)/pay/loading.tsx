import { WalletSkeleton } from "@/components/consumer/wallet/WalletPage";

// /pay's fallback is the Wallet as it will land (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"): the title, the line under it, and the card of rows in bones.
export default function PayLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Rewards</h1>
      <div className="mt-5">
        <WalletSkeleton />
      </div>
    </div>
  );
}
