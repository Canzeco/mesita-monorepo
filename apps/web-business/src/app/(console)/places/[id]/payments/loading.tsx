// Offers while business-web-get-payments answers (MESITA-3600): the five
// boxes, a header and its rows (MESITA-4885), in the page's own column.
export default function PaymentsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-8" aria-busy="true" aria-label="Loading Offers">
      {[3, 0, 5, 2, 3].map((rows, n) => (
        <div key={n} className="border-border bg-card divide-border divide-y rounded-2xl border">
          <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
            <div className="bg-muted size-9 animate-pulse rounded-lg" />
            <div className="bg-muted h-5 w-40 animate-pulse rounded" />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex min-h-17 items-center gap-4 px-5 py-3 sm:px-6">
              <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
              <div className="bg-muted h-10 w-34 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
