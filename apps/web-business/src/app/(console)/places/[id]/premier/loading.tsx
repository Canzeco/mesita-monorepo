// Premier while business-web-get-premier answers (MESITA-3632): the status
// card and the three plan boxes at their real heights, so nothing jumps.
export default function PremierLoading() {
  return (
    <div className="flex flex-col gap-6 pb-8" aria-busy="true" aria-label="Loading Premier">
      <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <div className="bg-muted h-8 w-28 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-4 w-64 max-w-full animate-pulse rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5">
            <div className="bg-muted h-4 w-12 animate-pulse rounded" />
            <div className="bg-muted h-8 w-40 animate-pulse rounded" />
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
            <div className="border-border border-t pt-4">
              <div className="bg-muted h-4 w-20 animate-pulse rounded" />
            </div>
            <div className="bg-muted h-11 w-full animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
