import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { Skeleton } from "@/components/shared/Skeleton";
import { PayHeader } from "./PayHeader";
import { TicketsShortcut } from "./TicketsShortcut";
import { PAY_ROW, PAY_THUMB, SECTION_ROWS } from "./pay-sections";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "bill" | "proof" }) {
  if (body === "list") {
    // /pay: the Wallet's header, the menu's three tiles and its box
    // (MESITA-4838), in grey bones with no words (MESITA-4596).
    return (
      <div className="bg-card flex h-full min-h-0 flex-col px-2" aria-busy>
        <PayHeader title="Mesita" action={<TicketsShortcut icon />} />
        <div className="mt-2 grid shrink-0 grid-cols-3 gap-2">
          <Skeleton className="h-[92px] min-w-0 rounded-2xl" aria-hidden />
          <Skeleton className="h-[92px] min-w-0 rounded-2xl" aria-hidden />
          <Skeleton className="h-[92px] min-w-0 rounded-2xl" aria-hidden />
        </div>
        <div className="bg-muted -mx-2 mt-2 flex min-h-0 flex-1 flex-col p-1.5">
          <div className="bg-card min-h-0 flex-1 overflow-hidden rounded-xl">
            <div className="border-border flex h-14 items-center border-b px-4">
              <Skeleton className="h-4 w-32" aria-hidden />
            </div>
            <div className={SECTION_ROWS}>
              <LoyaltyCardBoxSkeleton />
              <LoyaltyCardBoxSkeleton />
              <LoyaltyCardBoxSkeleton />
            </div>
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
    <div aria-hidden>
      <span className={PAY_ROW}>
        <Skeleton className={PAY_THUMB} />
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
      </span>
    </div>
  );
}
