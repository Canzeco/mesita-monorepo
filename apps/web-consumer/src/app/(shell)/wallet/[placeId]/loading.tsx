import { Screen } from "@/components/consumer/nav/Screen";
import { WalletCardSkeleton } from "@/components/consumer/wallet/WalletCard";

// A House Card's frame (MESITA-2701): the pushed page's own header (Screen,
// MESITA-3647) and the card in bones.
export default function Loading() {
  return (
    <Screen title="Wallet" flush>
      <div className="px-4 pt-5" aria-busy>
        <WalletCardSkeleton count={1} />
      </div>
    </Screen>
  );
}
