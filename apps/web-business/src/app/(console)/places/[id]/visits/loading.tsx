// Visits' bones (MESITA-4732): one card of closed visit rows, face · name and
// time · total, so a chip tap never leaves the old screen painted.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 pb-8" aria-busy="true" aria-label="Loading Visits">
      <div className="border-border bg-card divide-border divide-y rounded-2xl border">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid grid-cols-[32px_minmax(0,1fr)_auto_16px] items-center gap-x-3 px-4 py-2.5 sm:px-5">
            <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
            <div className="flex flex-col gap-1.5">
              <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
              <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
            </div>
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            <div className="bg-muted h-4 w-4 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
