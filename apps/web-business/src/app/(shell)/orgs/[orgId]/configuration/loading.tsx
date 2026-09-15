// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one.
//
// FIVE BOXES, because the page is five boxes (MESITA-1852, merged to four in
// MESITA-1866, split into the two tiers in MESITA-1867). It once drew one
// 192px card — the shape of the two-door page this replaced — so every load
// ended in a layout shift on swap. A skeleton is a promise about what is
// coming.
//
// THE ORDER AND THE HEIGHTS FOLLOW THE PAGE (MESITA-1861). The page reads
// Mesita Partner · Mesita Pay · Members · Brand · Developers, and its live
// boxes wear the label lane — so a skeleton still promising the old order
// would shift every load by exactly the distance the split moved things.
//
// Mesita Partner is the TALL one (h-48): the price row, a seam, a lead and
// three lines. Mesita Pay is drawn as the STRIP (72px, the Soon height): that
// is the state Pato's organization — and every new one — lands in, and the
// lifted Section it becomes once partnered is the exception, not the promise.
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
        {/* Mesita Partner · Mesita Pay (strip) · Members, then the two Soon
            strips. */}
        <div className="bg-muted h-48 animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-32 animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
