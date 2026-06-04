export function TicketDetailsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-3">
      <div className="surface-card-soft h-36 rounded-3xl bg-muted/20" />
      <div className="surface-card space-y-3 p-4">
        <div className="h-8 w-24 rounded-full bg-muted" />
        <div className="h-7 w-3/4 rounded bg-muted" />
        <div className="h-16 rounded-2xl bg-muted" />
        <div className="h-12 w-full rounded-full bg-muted" />
      </div>
    </div>
  );
}
