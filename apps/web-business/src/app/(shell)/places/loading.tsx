// The list's skeleton: the sticky head band, then rows of thumb + name. Same
// shape as the table, so nothing shifts when it lands.
export default function Loading() {
  return (
    <div className="border-border bg-card -mx-4 overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border">
      <div className="bg-muted/30 h-[68px] animate-pulse" />
      <div className="divide-border/60 divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="bg-muted h-11 w-11 shrink-0 animate-pulse rounded-lg" />
            <div className="bg-muted h-4 w-40 animate-pulse rounded" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading places…</span>
    </div>
  );
}
