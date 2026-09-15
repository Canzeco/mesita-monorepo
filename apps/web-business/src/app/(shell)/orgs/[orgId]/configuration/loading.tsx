// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one.
//
// FIVE BOXES, because the page is five boxes (MESITA-1852). It drew one 192px
// card — the shape of the two-door page this replaced — so every load ended in
// a layout shift on swap. A skeleton is a promise about what is coming.
//
// THE ORDER AND THE HEIGHTS FOLLOW THE PAGE (MESITA-1861). The page now reads
// Stripe · Partnership · Members · Brand · Developers, and its boxes wear the
// label lane — so a skeleton still promising the old order would shift every
// load by exactly the distance the reorder moved things. The two Soon strips
// also shrank when they took Section's padding and 12px line.
export default function ConfigurationLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading configuration…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {/* The h1 and its caption, now one group with a `gap-1` between. */}
        <div className="flex flex-col gap-1">
          <div className="bg-muted h-8 w-64 animate-pulse rounded" />
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        </div>
        {/* Stripe · Partnership · Members, then the two Soon strips. The
            three live boxes are shorter than they were: the lane puts each
            one's title beside its body instead of above it. */}
        <div className="bg-muted h-28 animate-pulse rounded-2xl" />
        <div className="bg-muted h-28 animate-pulse rounded-2xl" />
        <div className="bg-muted h-32 animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
