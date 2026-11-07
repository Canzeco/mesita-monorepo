import { Skeleton } from "@/components/shared";

// /pay's fallback: the page's own frame, its title and line as themselves and
// the card as a block (Pato, MESITA-2701: "the placeholders must be similar to
// the page you are loading"). The page reads nothing today, so this shows only
// on a bar tap's server round trip.
export default function PayLoading() {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8" aria-busy>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
      <p className="text-muted-foreground type-body mt-1">Pay a bill from your phone, with your credit and your card.</p>
      <Skeleton className="mt-6 h-56 w-full rounded-2xl" />
    </div>
  );
}
