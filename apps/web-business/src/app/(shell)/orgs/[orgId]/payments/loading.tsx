// Payments: a title, the Stripe Account card, the Partner card.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading payments…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-40 animate-pulse rounded" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
