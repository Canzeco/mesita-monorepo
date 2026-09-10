// The Place screen is `force-dynamic` behind two Edge Function round trips,
// so it always shows this first.
//
// The heights MIRROR the real layout exactly (260px band under `md`, 300px
// at and above it, three cards below). A skeleton whose blocks are the wrong
// size causes the very layout shift it exists to prevent — so if the gallery
// or the cards change height, this changes with them.
//
// The name/subtitle blocks are GONE (MESITA-1558, still true at MESITA-1714):
// that content is `PlaceHeading`, which the layout renders above this boundary
// and which therefore paints before the skeleton does. Reserving space for it
// here would double-count it and produce the jump this file exists to avoid.
export default function PlaceLoading() {
  return (
    <>
      <span className="sr-only">Loading place</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
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
