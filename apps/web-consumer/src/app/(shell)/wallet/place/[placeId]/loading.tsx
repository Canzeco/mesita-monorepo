import { Screen } from "@/components/consumer/nav/Screen";
import { LoyaltyCardSkeleton, PlaceTitleBones } from "@/components/consumer/wallet/PlaceCredit";

// A Loyalty Card's frame (MESITA-2701): the pushed page's own header (Screen,
// MESITA-3647) and the page in bones (MESITA-3741). NO WORDS (MESITA-4332):
// the header's place photo and name are a round bone and a bar, never
// "Wallet".
export default function Loading() {
  return (
    <Screen
      title=""
      titleMark={<PlaceTitleBones />}
      flush
      paper
      scrolls
    >
      <div className="px-4 pt-5" aria-busy>
        <LoyaltyCardSkeleton />
      </div>
    </Screen>
  );
}
