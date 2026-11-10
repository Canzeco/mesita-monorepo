// The Reserve page's own placeholder, so the place screen's skeleton
// (place/[id]/loading.tsx) never stands in for it.
export default function PlaceReserveLoading() {
  return (
    <div className="bg-background flex flex-1 flex-col px-5 pt-4" aria-busy>
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-muted h-9 w-9 rounded-full" />
        <div className="bg-muted h-4 w-40 rounded" />
      </div>
      <div className="bg-muted h-7 w-48 rounded" />
      <div className="bg-muted mt-6 h-16 w-full rounded-2xl" />
      <div className="bg-muted mt-4 h-10 w-full rounded-full" />
      <div className="bg-muted mt-4 h-14 w-full rounded-2xl" />
    </div>
  );
}
