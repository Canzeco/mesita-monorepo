import { Screen } from "@/components/consumer/nav/Screen";
import { RowsSkeleton, WALLET_PANEL } from "@/components/consumer/wallet/WalletLists";

// /wallet/methods' frame (MESITA-4526): the header in place, three rows in bones.
export default function Loading() {
  return (
    <Screen title="Payment methods" paper>
      <div className="px-4 pt-3">
        <div className={WALLET_PANEL}>
          <RowsSkeleton count={3} />
        </div>
      </div>
    </Screen>
  );
}
