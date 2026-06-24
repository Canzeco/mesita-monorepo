export function TicketDetailsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-3">
      <div className="surface-card-soft ring-secondary/15 overflow-hidden ring-1">
        <div className="p-4">
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <div className="bg-muted h-[88px] rounded-xl" />
            <div className="flex h-[88px] flex-col gap-1.5">
              <div className="bg-muted/60 flex-1 rounded-xl" />
              <div className="bg-muted/60 flex-1 rounded-xl" />
              <div className="bg-muted/60 flex-1 rounded-xl" />
            </div>
          </div>
          <div className="bg-muted/40 mt-3 h-16 rounded-xl" />
          <div className="bg-muted mt-3 h-14 rounded-xl" />
        </div>
      </div>
      <div className="surface-card space-y-3 p-4">
        <div className="bg-muted h-8 w-24 rounded-full" />
        <div className="bg-muted h-20 rounded-2xl" />
        <div className="bg-muted h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
