// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one. Customers is a title, a line and one dashed strip.
export default function CustomersLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading customers…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-44 animate-pulse rounded" />
        <div className="bg-muted h-4 w-80 animate-pulse rounded" />
        <div className="bg-muted h-[72px] animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
