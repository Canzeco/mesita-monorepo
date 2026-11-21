import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { Skeleton } from "@/components/shared/Skeleton";
import { PayHeader } from "./PayHeader";
import { TicketsShortcut } from "./TicketsShortcut";
import { SECTION_BOX, SECTION_TITLE } from "./pay-sections";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "bill" | "proof" }) {
  if (body === "list") {
    // /pay (Pato, 2026-11-21, MESITA-4523: "update placeholders when loading
    // page"): the page as MESITA-4559 draws it. The white Mesita Wallet header
    // with its Tickets icon, Pay Bill, Add funds | Send Gift (all 56px,
    // MESITA-4560), then the Payment method and Loyalty Cards boxes on grey.
    return (
      <div className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-2 *:shrink-0" aria-busy>
        <PayHeader title="Mesita Wallet" action={<TicketsShortcut icon />} />
        <Skeleton className="mt-2 h-14 w-full rounded-xl bg-[#635BFF]/40" aria-hidden />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Skeleton className="h-14 min-w-0 rounded-xl" aria-hidden />
          <Skeleton className="h-14 min-w-0 rounded-xl" aria-hidden />
        </div>
        <div className="bg-border -mx-2 mt-3 flex flex-1 flex-col px-2 pb-8">
          <p className={SECTION_TITLE}>Payment method</p>
          <div className={SECTION_BOX}>
            <span className="flex h-14 items-center gap-3 px-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </span>
          </div>
          <p className={SECTION_TITLE}>Loyalty Cards</p>
          <div className={SECTION_BOX}>
            <LoyaltyCardBoxSkeleton />
            <LoyaltyCardBoxSkeleton />
            <LoyaltyCardBoxSkeleton />
          </div>
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

/** One Loyalty Cards row in bones (MESITA-4560): card, name and amount, one
 *  line since MESITA-4573. No box of its own: it sits in the Loyalty Cards box. */
export function LoyaltyCardBoxSkeleton() {
  return (
    <div className="px-3 py-2.5" aria-hidden>
      <span className="flex min-h-11 items-center gap-3">
        <Skeleton className="h-[26px] w-10 shrink-0 rounded-[5px]" />
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="ml-auto h-4 w-16 rounded" />
      </span>
    </div>
  );
}
