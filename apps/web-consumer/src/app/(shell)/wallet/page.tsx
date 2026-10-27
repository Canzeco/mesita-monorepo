import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

// Wallet — ONE page, the Soon state, like Pay (Pato, MESITA-2858: "change
// the share to Wallet and call it Soon as pay"). No action button: there is
// nothing to hold in it yet.
export default function WalletPage() {
  return (
    <EmptyState
      icon={Wallet}
      title="Wallet is coming soon"
      description="Your Mesita balance lands here shortly — thanks for waiting."
    />
  );
}
