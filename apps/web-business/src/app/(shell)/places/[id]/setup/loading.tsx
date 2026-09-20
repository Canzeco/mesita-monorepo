// The catalogue's skeleton, in the page's own order: the lead line, the
// partnership strip, the filter row, then the grid. A skeleton that guesses a
// different shape ends every load in a layout shift, which is the fault
// MESITA-1861 fixed on the organization's own page.
//
// NO TITLE BAR (MESITA-1892). The page is the PLACE's now, so its heading is
// `PlaceHeading` — rendered by the layout, OUTSIDE this boundary, and held
// through the wait. Drawing one here would promise a second heading.
export default function Loading() {
  return (
    <>
      <div className="bg-muted h-4 w-80 animate-pulse rounded" />
      <div className="border-border bg-card h-[72px] animate-pulse rounded-2xl border" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-8 w-28 animate-pulse rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="border-border bg-card h-56 animate-pulse rounded-2xl border"
          />
        ))}
      </div>
    </>
  );
}
