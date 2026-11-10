// Reservations while the place layout answers (MESITA-3600): its one row.
export default function ReservationsLoading() {
  return (
    <div className="flex flex-col gap-4 pb-8" aria-busy="true" aria-label="Loading Reservations">
      <div className="border-border bg-card rounded-2xl border">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="bg-muted size-10 animate-pulse rounded-xl" />
          <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
          <div className="bg-muted h-6 w-11 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}
