import { Screen } from "@/components/consumer/nav/Screen";
import { Skeleton } from "@/components/shared/Skeleton";

// /wallet/place/<placeId>/send's frame (MESITA-4096): the header in place,
// the amount and the button in bones.
export default function Loading() {
  return (
    <Screen title="Send Gift" paper>
      <div className="flex flex-col items-center pt-6" aria-busy>
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton className="mt-6 h-12 w-60 max-w-full" />
        <Skeleton className="mt-8 h-12 w-full rounded-xl" />
      </div>
    </Screen>
  );
}
