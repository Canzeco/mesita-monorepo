// The skeleton every Monitor page shows while its list loads (MESITA-4538): one
// card of six grey rows, so a chip tap never leaves the old screen painted.
export function MonitorLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4 pb-8" aria-busy="true" aria-label={`Loading ${label}`}>
      <div className="border-border bg-card divide-border divide-y rounded-2xl border">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
              <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            </div>
            <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
