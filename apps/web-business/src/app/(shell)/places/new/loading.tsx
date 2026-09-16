// The boundary is SEARCH-shaped now (MESITA-1850), not form-shaped: one
// full-width bar and the line under it. It drew a 520px column with a field
// and a button — the shape of the screen this replaced, so every load ended
// in a layout shift on swap. A skeleton is a promise about what is coming.
//
// No result rows are drawn: an empty search HAS none, and promising a list
// before a query exists is a second lie.
export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="flex w-full flex-col gap-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded" />
        <div className="bg-muted h-14 w-full animate-pulse rounded-2xl" />
        <div className="bg-muted h-4 w-96 max-w-full animate-pulse rounded" />
      </div>
    </div>
  );
}
