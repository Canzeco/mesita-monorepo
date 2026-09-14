// In Next 16 a route with no loading boundary does not fall back to a
// parent's: the router keeps the PREVIOUS screen painted for the whole server
// wait (MESITA-1729), which reads as a broken menu rather than a slow one.
//
// A flat address resolves the remembered scope over the network before it can
// forward, so it has a wait of its own even though it renders almost nothing.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
