import { Skeleton } from "@/components/shared";

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
        <Skeleton className="mt-2 h-16 w-full rounded-xl" />
      </div>
    );
  }
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8" aria-busy>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
      <Skeleton className="mt-5 h-[26rem] w-full rounded-2xl" />
    </div>
  );
}
