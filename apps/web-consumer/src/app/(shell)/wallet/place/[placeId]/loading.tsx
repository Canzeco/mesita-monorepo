import { Screen } from "@/components/consumer/nav/Screen";
import { Skeleton } from "@/components/shared/Skeleton";
import { LoyaltyCardSkeleton } from "@/components/consumer/wallet/PlaceCredit";

// A Loyalty Card's frame (MESITA-2701): the pushed page's own header (Screen,
// MESITA-3647) and the page in bones (MESITA-3741). NO WORDS (MESITA-4332):
// the header's place photo and name are a round bone and a bar, never
// "Wallet".
export default function Loading() {
  return (
    <Screen
      title=""
      titleMark={
        <span className="flex items-center gap-2" aria-hidden>
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-40 rounded-md" />
        </span>
      }
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
