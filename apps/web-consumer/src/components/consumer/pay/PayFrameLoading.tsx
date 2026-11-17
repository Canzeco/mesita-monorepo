import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { PayHeader } from "./PayHeader";
import { PayBillSkeleton } from "./PayPage";
import { WalletShareGift } from "@/components/consumer/wallet/WalletShareGift";
import { TicketsShortcut } from "./TicketsShortcut";
import { WalletBodySkeleton } from "../wallet/WalletLists";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "bill" | "proof" }) {
  if (body === "list") {
    // /pay (MESITA-4232): the title band, Pay Bill's shape, the three
    // buttons as themselves, then the money in bones.
    return (
      <div className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-2 pb-8 *:shrink-0" aria-busy>
        <PayHeader title="Mesita Wallet" action={<TicketsShortcut />} />
        <PayBillSkeleton />
        <WalletShareGift />
        <WalletBodySkeleton />
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
