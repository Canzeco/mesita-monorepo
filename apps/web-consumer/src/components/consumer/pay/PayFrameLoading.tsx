import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { Skeleton } from "@/components/shared/Skeleton";
import { PayHeader } from "./PayHeader";
import { GiftShortcut, TicketsShortcut } from "./TicketsShortcut";
import { PAY_ROW, PAY_THUMB, SECTION_ROWS } from "./pay-sections";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "bill" | "proof" }) {
  if (body === "list") {
    // /pay (Pato, 2026-11-21, MESITA-4523: "update placeholders when loading
    // page"): the page as MESITA-4559 draws it. The white Mesita Wallet header
    // with its Tickets button, Pay Bill · Prepay | Send Gift · Explore Offers
    // (MESITA-4731), then the Loyalty Cards card on white.
    return (
      <div className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-2 *:shrink-0" aria-busy>
        <PayHeader title="Mesita" beside={<GiftShortcut />} action={<TicketsShortcut icon />} />
        {/* GREY BONES ONLY (Pato, 2026-11-21, MESITA-4596): no colour and no
            words while the page reads. The shape is MESITA-4731's: Pay Bill
            across, Prepay | Send Gift (all 112px since MESITA-4735), the quiet Explore
            Offers row (Pato, 2026-11-23: "also update the placeholders"). */}
        {/* MESITA-4748: Prepay | Pay Bill. */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Skeleton className="aspect-[8/5] min-w-0 rounded-2xl" aria-hidden />
          <Skeleton className="aspect-[8/5] min-w-0 rounded-2xl" aria-hidden />
        </div>
        {/* MESITA-4785: the third box (grey while loading, MESITA-4801), the switch on top and its rows below
            in the same card. */}
        <div className="mt-2 flex flex-1 flex-col pb-8">
          <section className="bg-muted rounded-2xl p-1.5">
            <div className="pb-1.5">
              <div className="bg-foreground/10 h-10 w-full animate-pulse rounded-xl" aria-hidden />
            </div>
            <div className="bg-card overflow-hidden rounded-xl">
              <div className={SECTION_ROWS}>
                <LoyaltyCardBoxSkeleton />
                <LoyaltyCardBoxSkeleton />
                <LoyaltyCardBoxSkeleton />
              </div>
            </div>
          </section>
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
