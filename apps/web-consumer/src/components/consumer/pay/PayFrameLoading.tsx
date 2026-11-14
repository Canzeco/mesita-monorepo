import { Skeleton } from "@/components/shared";
import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { PayHeader } from "./PayHeader";
import { WalletShareGift } from "@/components/consumer/wallet/WalletShareGift";
import { WalletBodySkeleton } from "../wallet/WalletLists";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "wallet" | "proof" }) {
  if (body === "list") {
    // /pay: the band (title and search bar, MESITA-3886) and the places.
    return (
      <div className="scrollbar-hide bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8" aria-busy>
        <PayHeader title="Pay" bar={<span className="text-muted-foreground text-sm font-semibold">Search a place</span>} />
        <Skeleton className="mt-5 h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (body === "wallet") {
    // /wallet (MESITA-3886): the title band and the Share and Gift buttons as
    // themselves (they read nothing), then the page's own skeleton
    // (MESITA-3814: the rows' shape, the same one the page shows while its one
    // read runs), so nothing jumps.
    return (
      <div className="scrollbar-hide bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8" aria-busy>
        <PayHeader title="Wallet" />
        <WalletShareGift />
        <WalletBodySkeleton />
      </div>
    );
  }
  // A bill or a receipt: the pushed page's own frame (Screen, MESITA-3647),
  // white and in the step's own shape (MESITA-3739), so nothing jumps.
  return (
    <Screen title="Pay" flush paper>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <GuestPayLoading />
      </div>
    </Screen>
  );
}
