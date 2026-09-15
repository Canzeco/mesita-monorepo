// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one.
//
// FIVE BOXES, because the page is five boxes (MESITA-1852). It drew one 192px
// card — the shape of the two-door page this replaced — so every load ended in
// a layout shift on swap. A skeleton is a promise about what is coming.
export default function ConfigurationLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading configuration…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded" />
        <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        {/* Brand · Members · Stripe · Partnership · Developers. The two Soon
            strips are shorter than the three live boxes, and the skeleton
            says so rather than promising five equal cards. */}
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-40 animate-pulse rounded-2xl" />
        <div className="bg-muted h-44 animate-pulse rounded-2xl" />
        <div className="bg-muted h-32 animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
