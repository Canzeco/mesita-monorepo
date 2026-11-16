import { Screen } from "@/components/consumer/nav/Screen";
import { AddRow, RowsSkeleton, WalletPanelList } from "@/components/consumer/wallet/WalletLists";

// /wallet/buy's frame (MESITA-4096): the header in place, the list in bones,
// ending with the page's own Add a Credits Card row (MESITA-4119).
export default function Loading() {
  return (
    <Screen title="Buy Credits" paper>
      <WalletPanelList title="Places">
        <RowsSkeleton count={3} />
        <AddRow line="Add a Credits Card" ariaLabel="Add a Credits Card" disabled />
      </WalletPanelList>
    </Screen>
  );
}
