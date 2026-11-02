import { QrCode } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { WalletPage } from "@/components/consumer/wallet/WalletPage";

// Pay — the Soon state again (Pato, 2026-11-02: "Pay must be as Soon";
// MESITA-3113). The bar's tab wears the Soon tag.
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
      title="Pay is coming soon"
      description="Paying at a place with Mesita lands here shortly — thanks for waiting."
    />
  );
}
