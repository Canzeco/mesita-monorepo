// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one.
//
// THREE BOXES, because the page is three boxes (MESITA-1869): Members, then
// the two honest Soons. Mesita Partner and Mesita Pay left for the catalogue,
// and a skeleton still promising them would shift every load by the height of
// two cards that are not coming — which is exactly the fault this file was
// written to fix (MESITA-1729), in reverse.
export default function ConfigurationLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading configuration…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {/* The h1 and its caption, one group with a `gap-1` between. */}
        <div className="flex flex-col gap-1">
          <div className="bg-muted h-8 w-64 animate-pulse rounded" />
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        </div>
        {/* Members, then Brand and Developers at the strip's 72px. */}
        <div className="bg-muted h-32 animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
