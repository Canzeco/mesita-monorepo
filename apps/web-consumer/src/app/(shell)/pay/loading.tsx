import { Skeleton } from "@/components/shared";

// /pay's fallback: the page's own frame, its title and line as themselves and
// the card as a block (Pato, MESITA-2701: "the placeholders must be similar to
// the page you are loading"). PayPage.tsx draws the same words.
export default function PayLoading() {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8" aria-busy>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
      <p className="text-muted-foreground type-body mt-1">Pay a bill with your credit at a place.</p>
      <Skeleton className="mt-5 h-28 w-full rounded-2xl" />
      <Skeleton className="mt-5 h-12 w-full rounded-xl" />
      <Skeleton className="mt-6 h-12 w-full rounded-2xl" />
    </div>
  );
}
