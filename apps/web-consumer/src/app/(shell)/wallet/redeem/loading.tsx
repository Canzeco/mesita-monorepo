import { Screen } from "@/components/consumer/nav/Screen";
import { Skeleton } from "@/components/shared/Skeleton";

// /wallet/redeem's frame (MESITA-4020): the header in place, the field and
// the button in bones.
export default function Loading() {
  return (
    <Screen title="Claim gift" paper>
      <div className="flex flex-col items-center pt-6" aria-busy>
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="mt-8 h-12 w-full rounded-xl" />
      </div>
    </Screen>
  );
}
