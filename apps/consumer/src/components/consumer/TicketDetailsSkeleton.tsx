export function TicketDetailsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-3 p-3">
      <div className="surface-card p-3">
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
          <div className="h-[72px] rounded-xl bg-muted" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
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
