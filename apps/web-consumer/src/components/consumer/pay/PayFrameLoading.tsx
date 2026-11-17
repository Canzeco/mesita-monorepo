import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { PayHeader } from "./PayHeader";
import { ListSkeleton } from "./PayPage";
import { WalletShareGift } from "@/components/consumer/wallet/WalletShareGift";
import { TicketsShortcut } from "./TicketsShortcut";
import { WalletBodySkeleton } from "../wallet/WalletLists";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "wallet" | "bill" | "proof" }) {
  if (body === "list") {
    // /pay (MESITA-4204): the title band, the four buttons as themselves,
    // then the Pay box (QR, search bar, places) in bones.
    return (
      <div className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8 *:shrink-0" aria-busy>
        <PayHeader title="Pay" action={<TicketsShortcut />} />
        <WalletShareGift />
        <ListSkeleton />
      </div>
    );
  }
  if (body === "wallet") {
    // /wallet (MESITA-3886): the title band and the Share and Gift buttons as
    // themselves (they read nothing), then the page's own skeleton
    // (MESITA-3814: the rows' shape, the same one the page shows while its one
    // read runs), so nothing jumps.
    return (
      <div className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8" aria-busy>
        <PayHeader title="Wallet" action={<TicketsShortcut />} />
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
