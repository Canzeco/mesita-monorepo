import { Screen } from "@/components/consumer/nav/Screen";
import { Skeleton } from "@/components/shared/Skeleton";

// /wallet/buy's frame (MESITA-4597): the list as it draws, edge to edge, grey
// bones only. No title: the same frame stands in for Prepay and Explore Offers
// (MESITA-4731), and the query that tells them apart is not known here.
// MESITA-4748: the location box's bone in the header, the banner's band, the
// outlined search box, then three place rows, each with its three offer boxes.
export default function Loading() {
  return (
    <Screen title="" paper flush action={<Skeleton className="h-9 w-24 rounded-xl" />}>
      <div className="flex flex-col" aria-busy>
        <Skeleton className="h-12 w-full rounded-none" />
        <div className="px-4 pt-4 pb-2">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <div className="border-border divide-border mt-3 divide-y border-y">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-start gap-3.5">
                <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="flex-1 pt-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((b) => (
                  <Skeleton key={b} className="h-[52px] min-w-0 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
