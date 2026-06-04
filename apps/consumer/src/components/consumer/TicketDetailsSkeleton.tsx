export function TicketDetailsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-3 p-3">
      <div className="surface-card overflow-hidden">
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 p-3">
          <div className="h-[72px] rounded-xl bg-muted" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
        <div className="border-border/60 flex gap-2 border-t px-3 py-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="h-7 w-7 rounded-full bg-muted" />
              <div className="h-2 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
      <div className="surface-card space-y-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-6 w-6 shrink-0 rounded-full bg-muted" />
            <div className="h-4 flex-1 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
