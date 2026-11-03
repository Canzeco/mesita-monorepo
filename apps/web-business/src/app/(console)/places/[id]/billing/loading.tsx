// Billing while business-web-get-billing answers (MESITA-3166, D6): the
// status block's line and bar, then three rows.
export default function BillingLoading() {
  return (
    <div className="flex flex-col gap-4 pb-8" aria-busy="true" aria-label="Loading Billing">
      <div className="flex flex-col gap-3 py-1">
        <div className="bg-muted h-8 w-64 max-w-full animate-pulse rounded-lg" />
        <div className="bg-muted h-4 w-80 max-w-full animate-pulse rounded" />
        <div className="bg-muted h-3 w-full animate-pulse rounded-full" />
      </div>
      <div className="border-border bg-card divide-border divide-y rounded-2xl border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4">
            <div className="bg-muted h-6 w-9 animate-pulse rounded-full" />
            <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
            <div className="bg-muted h-4 w-20 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
