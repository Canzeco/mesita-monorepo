import { Skeleton } from "@/components/shared";
import { Screen } from "@/components/consumer/nav/Screen";
import { GuestPayLoading } from "./GuestPayScreen";
import { PayHeader } from "./PayHeader";
import { CreditsCardSkeleton } from "../wallet/CreditsCard";
import { RowsSkeleton, WalletList } from "../wallet/WalletLists";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "wallet" | "proof" }) {
  if (body === "list") {
    // /pay: the band (switch and search bar, MESITA-3738) and the places.
    return (
      <div className="scrollbar-hide bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8" aria-busy>
        <PayHeader tab="pay" bar={<span className="text-muted-foreground text-sm font-semibold">Search a place</span>} />
        <Skeleton className="mt-5 h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (body === "wallet") {
    // /wallet, the switch's Wallet half (MESITA-3729): the switch, then the
    // page's order (MESITA-3736), built from its own skeletons so nothing
    // jumps: Money Payment Methods (a saved card, then Cash), then one
    // Credits Card (band, transactions, Fund | Gift).
    return (
      <div className="scrollbar-hide bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8" aria-busy>
        <PayHeader tab="wallet" />
        <WalletList title="Money Payment Methods">
          <RowsSkeleton count={2} />
        </WalletList>
        <section className="mt-5">
          <div className="mb-2 flex min-h-6 items-center">
            <h2 className="font-display text-base font-semibold tracking-tight">Credits Payment Methods</h2>
          </div>
          <CreditsCardSkeleton />
        </section>
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
