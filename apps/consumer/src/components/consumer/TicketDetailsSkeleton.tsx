export function TicketDetailsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-3">
      <div className="surface-card-soft overflow-hidden ring-1 ring-secondary/15">
        <div className="p-4">
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <div className="h-[88px] rounded-xl bg-muted" />
            <div className="flex h-[88px] flex-col gap-1.5">
              <div className="flex-1 rounded-xl bg-muted/60" />
              <div className="flex-1 rounded-xl bg-muted/60" />
              <div className="flex-1 rounded-xl bg-muted/60" />
            </div>
          </div>
          <div className="mt-3 h-16 rounded-xl bg-muted/40" />
          <div className="mt-3 h-14 rounded-xl bg-muted" />
        </div>
      </div>
      <div className="surface-card space-y-3 p-4">
        <div className="h-8 w-24 rounded-full bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-12 w-full rounded-full bg-muted" />
      </div>
    </div>
  );
}
