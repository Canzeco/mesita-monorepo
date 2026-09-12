// Nested under organization/loading.tsx. In Next 16 the parent's dashboard
// pulse would wrap this segment, so the ceremony has to paint a FORM, not
// two 132px cards (MESITA-1793).
export default function Loading() {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded" />
        <div className="bg-muted h-4 w-80 animate-pulse rounded" />
        <div className="bg-muted h-11 w-full animate-pulse rounded-xl" />
        <div className="bg-muted h-12 w-full animate-pulse rounded-full" />
      </div>
    </div>
  );
}
