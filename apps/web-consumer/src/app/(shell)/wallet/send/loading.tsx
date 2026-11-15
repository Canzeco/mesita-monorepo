import { Screen } from "@/components/consumer/nav/Screen";
import { RowsSkeleton, WalletPanelList } from "@/components/consumer/wallet/WalletLists";

// /wallet/send's frame (MESITA-4096): the header in place, the list in bones.
export default function Loading() {
  return (
    <Screen title="Send Gift" paper>
      <WalletPanelList title="Places">
        <RowsSkeleton count={3} />
      </WalletPanelList>
    </Screen>
  );
}
