import { Screen } from "@/components/consumer/nav/Screen";
import { Skeleton } from "@/components/shared/Skeleton";

// /wallet/cards/new's frame (MESITA-4092): the header in place, the form's
// panel in bones.
export default function Loading() {
  return (
    <Screen title="Add a card" paper>
      <div className="flex flex-col pt-4" aria-busy>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </Screen>
  );
}
