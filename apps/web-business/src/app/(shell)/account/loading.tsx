// Account had no loading boundary either, for the same reason and with the
// same effect: no boundary means the router holds the old screen and the click
// looks ignored (MESITA-1729). See organization/loading.tsx for the mechanism.
//
// IT MUST DRAW THE PAGE THAT ACTUALLY LOADS (MESITA-1833). This used to be a
// heading bar, one text line and a 132px card, then an identity header over
// two 64px rows — each time the shape of a page that no longer existed, so
// every load ended in a layout shift on swap. A skeleton is a promise about
// what is coming. Three boxes now (MESITA-1837), at the page's own height,
// stacked full width (MESITA-1836): one bar per box, nothing inside them.

export default function Loading() {
  return (
    <>
      <span className="sr-only">Loading account…</span>
      <div aria-hidden="true" className="bg-muted h-24 animate-pulse rounded-2xl" />
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="bg-muted h-24 animate-pulse rounded-2xl" />
        <div className="bg-muted h-24 animate-pulse rounded-2xl" />
      </div>
    </>
  );
}
