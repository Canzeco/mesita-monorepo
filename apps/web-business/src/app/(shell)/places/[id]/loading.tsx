// The Place screen is `force-dynamic` behind two Edge Function round trips,
// so it always shows this first.
//
// The heights MIRROR the real layout exactly (260px band under `md`, 300px
// at and above it, three cards below). A skeleton whose blocks are the wrong
// size causes the very layout shift it exists to prevent — so if the gallery
// or the cards change height, this changes with them.
export default function PlaceLoading() {
  return (
    <>
      <span className="sr-only">Loading place</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {/* back link + name + subtitle */}
        <div className="flex flex-col gap-3">
          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
          <div className="bg-muted h-8 w-64 animate-pulse rounded" />
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        </div>
        {/* the photo band */}
        <div className="bg-muted h-[260px] animate-pulse rounded-2xl md:h-[300px]" />
        {/* Identity · State · Holding */}
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
      </div>
    </>
  );
}
