import { Screen } from "@/components/consumer/nav/Screen";
import { HouseCardSkeleton } from "@/components/consumer/wallet/PlaceCredit";

// A House Card's frame (MESITA-2701): the pushed page's own header (Screen,
// MESITA-3647) and the amounts and buttons in bones (MESITA-3741).
export default function Loading() {
  return (
    <Screen title="Wallet" flush paper scrolls>
      <div className="px-4 pt-5" aria-busy>
        <HouseCardSkeleton />
      </div>
    </Screen>
  );
}
