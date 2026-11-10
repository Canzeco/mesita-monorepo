import { Skeleton } from "@/components/shared";
import { Screen } from "@/components/consumer/nav/Screen";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "proof" }) {
  if (body === "list") {
    // /pay: the header bar, the places list, then the Wallet's two rails
    // (MESITA-3631).
    return (
      <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8" aria-busy>
        <header className="border-border bg-card sticky top-0 z-10 -mx-4 flex min-h-[4.25rem] items-center border-b px-4 pt-5 pb-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
        </header>
        <Skeleton className="mt-5 h-6 w-40 rounded-md" />
        <Skeleton className="mt-2 h-12 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-56 w-full rounded-2xl" />
        <Skeleton className="mt-5 h-5 w-48 rounded-md" />
        <Skeleton className="mt-2 h-[5.5rem] w-full rounded-xl" />
      </div>
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
