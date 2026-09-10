// Organization had NO loading boundary, and in Next 16 that is not a neutral
// omission: LoadingBoundary returns a bare Fragment when `loading` is null
// (next/dist/.../layout-router.js), so a suspending segment finds no boundary
// of its own and the router simply keeps the PREVIOUS screen painted. Clicking
// Organization in the rail therefore did nothing visible for the ~900ms the
// server spent on its Edge Function calls, which reads as a broken menu rather
// than a slow one (MESITA-1729).
//
// The heading is a real block here, not omitted the way places/[id] omits it:
// that route renders PlaceHeading in the layout ABOVE its boundary, so
// reserving space would double-count. This page renders its own h1 inside the
// boundary, so the skeleton has to stand in for it.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading organization…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded" />
        <div className="bg-muted h-4 w-80 animate-pulse rounded" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
