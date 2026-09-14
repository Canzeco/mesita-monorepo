// Account had no loading boundary either, for the same reason and with the
// same effect: no boundary means the router holds the old screen and the click
// looks ignored (MESITA-1729). See organization/loading.tsx for the mechanism.
//
// IT MUST DRAW THE PAGE THAT ACTUALLY LOADS (MESITA-1833). This used to be a
// heading bar, one text line and a 132px card — the shape of a page that had
// a "You" card and drew its switchers as chips. The real Account is an
// identity header and two 64px selector rows, so every load ended in a layout
// shift on swap. A skeleton is a promise about what is coming; this one broke
// it on every visit.
export default function Loading() {
  return (
    <>
      <span className="sr-only">Loading account…</span>
      <div aria-hidden="true" className="flex items-center gap-3.5">
        <div className="bg-muted h-13 w-13 shrink-0 animate-pulse rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="bg-muted h-5 w-56 max-w-full animate-pulse rounded" />
          <div className="bg-muted mt-1.5 h-3 w-28 animate-pulse rounded" />
        </div>
        <div className="bg-muted h-7 w-24 shrink-0 animate-pulse rounded-full" />
      </div>
      <div className="border-border border-t" />
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="bg-muted h-16 animate-pulse rounded-2xl" />
        <div className="bg-muted h-16 animate-pulse rounded-2xl" />
      </div>
    </>
  );
}
