import { Screen } from "@/components/consumer/nav/Screen";
import { Skeleton } from "@/components/shared/Skeleton";

// /wallet/buy's frame (MESITA-4597): Prepay & Get Credits as it draws, edge to
// edge, grey bones only: the search pill, then three place rows.
export default function Loading() {
  return (
    <Screen title="Prepay & Get Credits" paper flush>
      <div className="flex flex-col pt-3" aria-busy>
        <div className="px-5 pt-3 pb-2">
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
        <div className="border-border divide-border mt-3 divide-y border-y">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-[4.5rem] items-center gap-3.5 px-5 py-3">
              <Skeleton className="h-8 w-12 shrink-0 rounded-md" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
