import { QrCode } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { WalletPage } from "@/components/consumer/wallet/WalletPage";

// The bar's Rewards tab (Pato, MESITA-3208: "for the moment ... name this reward,
// not pay"); the route stays /pay. Rewards live on each place (MESITA-3202), so
// this says where to find them. The bar's tab wears no tag (MESITA-3124).
//
// MONEY: a Mesita Prepay checkout (MESITA-3098) still returns here with
// `?prepay=<session>`, and the Wallet's read is what credits that payment,
// so that one return renders the Wallet. Nothing else links it.
export default async function PayPage({ searchParams }: { searchParams: Promise<{ prepay?: string }> }) {
  const { prepay } = await searchParams;
  if (prepay) return <WalletPage />;
  return (
    <EmptyState
      icon={QrCode}
      title="Rewards are on each place"
      description="Open a place and its Rewards tab shows what it offers you."
    />
  );
}
