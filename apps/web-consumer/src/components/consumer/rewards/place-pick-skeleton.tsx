/** The New Visit place list's loading frame.
 *
 *  This lives in its OWN leaf module — importing only Skeleton-level markup —
 *  so both the route fallback and PlacePickList itself can draw the same
 *  silhouette without the route pulling PlacePickList's fetch layer into the
 *  statically-bundled page chunk and defeating the dynamic() split.
 *
 *  Authoring it twice is what broke it before: the route fallback drew a
 *  passport card and two ticket rows for a screen that renders a search bar
 *  over places (MESITA-1229).
 *
 *  THREE rows, not four: the real count is unknown until the fetch lands, so
 *  the skeleton has to guess. It guesses LOW on purpose — content growing into
 *  place is gentler than content collapsing out from under a thumb already
 *  reaching for a row.
 *
 *  The footnote is reserved because it renders whenever ANY visible place is
 *  not a partner, which is the common case. Leaving it out made every load end
 *  with two lines of text appearing after the rows had already settled. */
export function PlacePickListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-3">
            <div className="bg-muted size-12 shrink-0 animate-pulse rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="bg-muted h-3.5 w-2/5 animate-pulse rounded" />
              <div className="bg-muted h-3 w-3/5 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1 px-1">
        <div className="bg-muted/70 h-2.5 w-full animate-pulse rounded" />
        <div className="bg-muted/70 h-2.5 w-3/5 animate-pulse rounded" />
      </div>
    </div>
  );
}
