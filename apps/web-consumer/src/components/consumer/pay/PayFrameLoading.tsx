import { Skeleton } from "@/components/shared";
import { Screen } from "@/components/consumer/nav/Screen";
import { PayWalletHeader } from "./PayWalletHeader";

/** A Pay screen's frame while it loads: the title in place, the body in
 *  bones (Pato, MESITA-2701: "the placeholders must be similar to the page
 *  you are loading"). Every Pay address draws it (MESITA-3614). */
export function PayFrameLoading({ body = "list" }: { body?: "list" | "wallet" | "proof" }) {
  if (body === "list" || body === "wallet") {
    // /pay and /wallet: the header and the Pay · Wallet band (MESITA-3698),
    // then the places list or the Wallet's two rails.
    return (
      <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8" aria-busy>
        <PayWalletHeader tab={body === "wallet" ? "wallet" : "pay"} />
        {body === "list" ? (
          <>
            <Skeleton className="mt-5 h-6 w-40 rounded-md" />
            <Skeleton className="mt-2 h-12 w-full rounded-2xl" />
            <Skeleton className="mt-3 h-56 w-full rounded-2xl" />
          </>
        ) : (
          <>
            <Skeleton className="mt-5 h-5 w-48 rounded-md" />
            <Skeleton className="mt-2 h-[12.25rem] w-full rounded-2xl" />
            <Skeleton className="mt-5 h-5 w-48 rounded-md" />
            <Skeleton className="mt-2 h-[8.125rem] w-full rounded-2xl" />
          </>
        )}
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
