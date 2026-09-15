// Payments is parked (MESITA-1852): a title and two dashed strips. It drew
// the Stripe and Partner boxes, which are Configuration's now — the shape of
// a page that no longer exists is a layout shift on every swap.
export default function PaymentsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading payments…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-44 animate-pulse rounded" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
