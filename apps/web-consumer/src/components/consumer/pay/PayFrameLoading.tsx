import { Skeleton } from "@/components/shared";
import { Screen } from "@/components/consumer/nav/Screen";
import { PayHeader } from "./PayHeader";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "wallet" | "proof" }) {
  if (body === "list") {
    // /pay: the header and the places (two tabs since MESITA-3722).
    return (
      <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8" aria-busy>
        <PayHeader />
        <Skeleton className="mt-5 h-6 w-40 rounded-md" />
        <Skeleton className="mt-3 h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (body === "wallet") {
    // /wallet, a page pushed from Pay (MESITA-3726): its frame and two lists.
    return (
      <Screen title="Wallet" flush>
        <div className="flex flex-col px-4 pb-8" aria-busy>
          <Skeleton className="mt-5 h-6 w-48 rounded-md" />
          <Skeleton className="mt-2 h-[12.25rem] w-full rounded-2xl" />
          <Skeleton className="mt-5 h-6 w-48 rounded-md" />
          <Skeleton className="mt-2 h-[8.25rem] w-full rounded-2xl" />
        </div>
      </Screen>
    );
  }
  // A bill or a receipt: the pushed page's own frame (Screen, MESITA-3647).
  return (
    <Screen title="Pay" flush>
      <div className="px-4 pt-5 pb-8" aria-busy>
        <Skeleton className="h-[26rem] w-full rounded-2xl" />
      </div>
    </Screen>
  );
}
