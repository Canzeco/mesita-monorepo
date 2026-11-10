// Payments while business-web-get-payments answers (MESITA-3600): section
// cards of rows, as the page draws them.
export default function PaymentsLoading() {
  return (
    <div className="flex flex-col gap-4 pb-8" aria-busy="true" aria-label="Loading Payments">
      {[1, 2, 3].map((rows, n) => (
        <div key={n} className="border-border bg-card divide-border divide-y rounded-2xl border">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="bg-muted size-10 animate-pulse rounded-xl" />
              <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
              <div className="bg-muted h-6 w-11 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
