// In Next 16 a route with no loading boundary does not fall back to a
// parent's: the router keeps the PREVIOUS screen painted for the whole server
// wait (MESITA-1729), which reads as a broken menu rather than a slow one.
// Every organization page has one. This is Overview's: a title, the standing
// card, three strips.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading organization…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded" />
        <div className="bg-muted h-[196px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[68px] animate-pulse rounded-xl" />
        <div className="bg-muted h-[68px] animate-pulse rounded-xl" />
        <div className="bg-muted h-[68px] animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
