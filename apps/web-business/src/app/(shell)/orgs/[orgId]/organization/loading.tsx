// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one. Organization is a title, a line, and one card of two rows.
export default function OrganizationLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading organization…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded" />
        <div className="bg-muted h-4 w-56 animate-pulse rounded" />
        <div className="bg-muted h-48 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
