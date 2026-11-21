import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { Skeleton } from "@/components/shared/Skeleton";
import { PayHeader } from "./PayHeader";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "bill" | "proof" }) {
  if (body === "list") {
    // /pay (MESITA-4504): Wallet, two modules, Pay, search, then place bones.
    return (
      <div className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-2 pb-8 *:shrink-0" aria-busy>
        <PayHeader title="Wallet" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-12 min-w-0 flex-1 rounded-xl" aria-hidden />
          <Skeleton className="h-12 min-w-0 flex-1 rounded-xl" aria-hidden />
        </div>
        <Skeleton className="mt-2 h-12 w-full rounded-xl" aria-hidden />
        <Skeleton className="mt-2 h-12 w-full rounded-xl" aria-hidden />
        <div className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-xl" aria-hidden />
          <Skeleton className="h-14 w-full rounded-xl" aria-hidden />
          <Skeleton className="h-14 w-full rounded-xl" aria-hidden />
        </div>
      </div>
    );
  }
  // A bill or a receipt: the pushed page's own frame (Screen, MESITA-3647),
  // white, its header as itself and one spinner (MESITA-3997). Both wear the
  // boxed ‹ (MESITA-4068).
  return (
    <Screen title="Pay" flush paper>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <GuestPayLoading />
      </div>
    </Screen>
  );
}
