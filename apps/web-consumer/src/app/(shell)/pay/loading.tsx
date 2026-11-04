import { BrandHeader } from "@/components/consumer/ModeTabs";
import { RewardRowsSkeleton } from "@/components/consumer/rewards/RewardPlaces";
import { Skeleton } from "@/components/shared";

// /pay's fallback is the Reward tab as it will land (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the sizes"):
// Home's header, then the card of rows in bones (MESITA-3214).
export default function PayLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <BrandHeader>
        <Skeleton className="ml-auto h-8 w-36 rounded-full" />
      </BrandHeader>
      <RewardRowsSkeleton />
    </div>
  );
}
