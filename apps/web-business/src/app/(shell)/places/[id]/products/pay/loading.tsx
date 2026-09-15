// The page's own order: heading, then the one box. Next 16 keeps the PREVIOUS
// screen painted for a route with no boundary of its own (MESITA-1729), which
// on a click from the catalogue reads as a button that did nothing.
export default function MesitaPayLoading() {
  return (
    <>
      <span className="sr-only">Loading Mesita Pay…</span>
      <div aria-hidden="true" className="flex flex-col gap-1">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted h-4 w-96 animate-pulse rounded" />
      </div>
      <div aria-hidden="true" className="bg-muted h-56 animate-pulse rounded-2xl" />
    </>
  );
}
