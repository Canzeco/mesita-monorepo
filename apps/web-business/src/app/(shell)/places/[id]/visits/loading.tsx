// Visits is a one-line summary, one ladder row, its strategy cards and the
// Partnership body. Next 16 keeps the OLD screen painted when a route has no
// loading boundary of its own, and the inherited `places/[id]/loading.tsx` is
// Profile's photo band — the shift this file prevents.
export default function VisitsLoading() {
  return (
    <>
      <span className="sr-only">Loading visits…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="bg-muted h-5 w-4/5 max-w-xl animate-pulse rounded-md motion-reduce:animate-none" />
        <div className="border-border overflow-hidden rounded-2xl border px-4 py-3">
          <div className="bg-muted h-10 animate-pulse rounded-md motion-reduce:animate-none" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="bg-muted h-[148px] animate-pulse rounded-2xl motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    </>
  );
}
