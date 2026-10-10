// The stand-in for a place view while its page resolves (MESITA-1734).
//
// WHY EACH VIEW NEEDS ITS OWN BOUNDARY. In Next 16 a route with no
// `loading.tsx` does not fall back to a parent's: `LoadingBoundary` returns a
// bare Fragment when `loading` is null, so the suspending segment finds no
// boundary and the router simply KEEPS THE PREVIOUS SCREEN PAINTED
// (MESITA-1729 found the same thing on Organization). And a sibling tab
// navigation does not re-run `places/[id]/layout.tsx`, so `[id]/loading.tsx`
// is not the boundary for it either — the changed segment is the tab.
//
// Every tab page awaits `getManagePlace(id)`, and the request cache does not
// span requests, so that is a real Edge Function round trip on every tab
// click. Without a boundary the rail's chevron opens a box, the pill moves,
// and the content underneath sits on the previous view for the duration —
// which reads as a broken toggle rather than a slow one. That is the exact
// failure the box design would otherwise have introduced.
//
// NO HEADING BLOCK, deliberately. `PlaceHeading` is rendered by the place
// LAYOUT, above this boundary, so it is already on screen. Reserving space
// for it here would double-count it and cause the shift this file exists to
// prevent — the same rule `places/[id]/loading.tsx` follows.

/** Card heights that mirror the real sections, in the order they render.
 *  A skeleton whose blocks are the wrong size causes the layout shift it
 *  exists to prevent, so these track the sections they stand in for. */
export function PlaceViewSkeleton({
  label,
  blocks,
}: {
  /** Announced to screen readers. The visual blocks are aria-hidden, so
   *  without this the wait is completely silent. */
  label: string;
  blocks: string[];
}) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {blocks.map((h, i) => (
          <div
            key={i}
            className={`bg-muted animate-pulse rounded-2xl motion-reduce:animate-none ${h}`}
          />
        ))}
      </div>
    </>
  );
}
