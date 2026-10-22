// /home/places and /home/social Suspense fallback (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). It draws NOTHING, on purpose: this boundary sits INSIDE
// home/layout.tsx, under the header and CatalogRails, and both pages render
// null, so any block drawn here would stack under the real screen.
//
// The file still does the work. Next prefetches a route down to its first
// loading.tsx, so with it a tap on the bar carries Home's layout: the real
// header, tab strip and family column, and CatalogRails' tile silhouettes
// (DiscoverFallback.tsx) or the Social feed's rows, at once, where the
// shell's centred spinner stood. A Places ↔ Social switch commits at once
// too, instead of waiting on the server for a page that renders null.
export default function HomeLoading() {
  return null;
}
