import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { Skeleton } from "@/components/shared/Skeleton";
import { PayHeader } from "./PayHeader";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "bill" | "proof" }) {
  if (body === "list") {
    // /pay (Pato, 2026-11-21, MESITA-4523: "update placeholders when loading
    // page"): the page MESITA-4519/4520 shipped. The white Wallet header, two
    // 48px buttons, Pay Bill 96px, Send Gift 56px, the hairline, then Loyalty
    // Card boxes. MESITA-4512's black slab and search bar before.
    return (
      <div className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-2 *:shrink-0" aria-busy>
        <PayHeader title="Mesita Wallet" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-12 min-w-0 flex-1 rounded-xl" aria-hidden />
          <Skeleton className="h-12 min-w-0 flex-1 rounded-xl" aria-hidden />
        </div>
        <Skeleton className="mt-2 h-24 w-full rounded-xl bg-[#635BFF]/40" aria-hidden />
        <Skeleton className="mt-2 h-14 w-full rounded-xl" aria-hidden />
        <div className="bg-border -mx-2 mt-3 flex flex-1 flex-col gap-2 px-2 pt-3 pb-8">
          <LoyaltyCardBoxSkeleton />
          <LoyaltyCardBoxSkeleton />
          <LoyaltyCardBoxSkeleton />
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

/** One Loyalty Card box in bones (MESITA-4537): the true 2x2 grid, card +
 *  name over balance, Offers over the moving offer. */
export function LoyaltyCardBoxSkeleton() {
  return (
    <div className="border-border bg-card grid w-full grid-cols-2 grid-rows-[3rem_3rem] gap-2 rounded-2xl border p-2" aria-hidden>
      <span className="border-border flex items-center gap-2 rounded-xl border px-3">
        <Skeleton className="h-[26px] w-10 shrink-0 rounded-[5px]" />
        <Skeleton className="h-4 w-24 rounded" />
      </span>
      <span className="border-border col-start-1 row-start-2 flex items-center rounded-xl border px-3">
        <Skeleton className="h-5 w-24 rounded" />
      </span>
      <Skeleton className="col-start-2 row-start-1 rounded-xl" />
      <Skeleton className="col-start-2 row-start-2 rounded-xl" />
    </div>
  );
}
