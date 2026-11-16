import { MeScreen } from "@/components/consumer/me/MeScreen";
import { RowsSkeleton, WalletPanelList } from "@/components/consumer/wallet/WalletLists";

// /me/gift's frame while the Wallet read is out (MESITA-2701): the page's own
// "Your credit" panel in bones, as the page draws while it loads (MESITA-4119).
export default function GiftLoading() {
  return (
    <MeScreen title="Gift">
      <WalletPanelList title="Your credit">
        <RowsSkeleton count={2} />
      </WalletPanelList>
    </MeScreen>
  );
}
