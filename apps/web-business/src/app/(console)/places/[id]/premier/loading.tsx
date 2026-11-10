// Premier while business-web-get-premier answers (MESITA-3638): the one
// card at its real shape, the level block and four rows, so nothing jumps.
export default function PremierLoading() {
  return (
    <div className="flex flex-col gap-3 pb-8" aria-busy="true" aria-label="Loading Premier">
      <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
        <div className="px-5 py-5 sm:px-6">
          <div className="bg-muted h-8 w-40 animate-pulse rounded" />
          <div className="bg-muted mt-2 h-4 w-64 max-w-full animate-pulse rounded" />
        </div>
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex min-h-19 items-center gap-6 px-5 py-3 sm:px-6">
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
            <div className="bg-muted h-11 w-28 animate-pulse rounded-full sm:w-42" />
          </div>
        ))}
      </div>
      <div className="bg-muted mx-1 h-4 w-96 max-w-full animate-pulse rounded" />
    </div>
  );
}
