import { ModeTabs } from "@/components/consumer/ModeTabs";
import { RewardPlaces } from "@/components/consumer/rewards/RewardPlaces";
import { WalletPage } from "@/components/consumer/wallet/WalletPage";

// The bar's Reward tab (Pato, MESITA-3208, MESITA-3211: "name this reward,
// not pay"); the route stays /pay. Home's header over every Mesita place,
// nearest first, and a tap opens the QR (MESITA-3214). The bar's tab wears no
// tag (MESITA-3124).
//
// MONEY: a Mesita Prepay checkout (MESITA-3098) still returns here with
// `?prepay=<session>`, and the Wallet's read is what credits that payment,
// so that one return renders the Wallet. Nothing else links it.
export default async function PayPage({ searchParams }: { searchParams: Promise<{ prepay?: string }> }) {
  const { prepay } = await searchParams;
  if (prepay) return <WalletPage />;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ModeTabs />
      <RewardPlaces />
    </div>
  );
}
