// One line and one strip, which is all this page is until the engine exists.
// Next 16 keeps the OLD screen painted when a route has no loading boundary of
// its own, and the inherited `places/[id]/loading.tsx` is Profile's photo band
// — the shift this file prevents.
export default function CapitalLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading capital…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-4 w-80 animate-pulse rounded" />
        <div className="bg-muted h-[72px] animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
