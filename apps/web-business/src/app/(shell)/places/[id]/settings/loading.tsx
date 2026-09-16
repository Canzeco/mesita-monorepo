// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one.
//
// TWO BOXES, because the page is two boxes (MESITA-1870): the team, then the
// one honest Soon. Mesita Partner and Mesita Pay left for the catalogue
// (MESITA-1869) and Brand left after them, and a skeleton still promising any
// of them would shift every load by the height of a card that is not coming —
// exactly the fault this file was written to fix (MESITA-1729), in reverse.
//
// AND NO HEADING BAR (MESITA-1892). The page is the PLACE's now, so its `h1`
// is `PlaceHeading`, which the layout renders OUTSIDE this boundary and holds
// through the wait. Drawing a title skeleton here would promise a second one.
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading settings…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {/* Access, then Developers at the strip's 72px. */}
        <div className="bg-muted h-32 animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
