// Capabilities is a row list under a one-line summary (MESITA-1739). Next 16
// keeps the OLD screen painted when a route has no loading boundary, and the
// inherited `places/[id]/loading.tsx` is Profile's 260px photo band plus three
// cards — which would cause the shift this file exists to prevent.
export default function CapabilitiesLoading() {
  return (
    <>
      <span className="sr-only">Loading capabilities…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="bg-muted h-5 w-4/5 max-w-xl animate-pulse rounded-md motion-reduce:animate-none" />
        <div className="border-border divide-border/60 divide-y overflow-hidden rounded-2xl border">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="bg-muted h-10 min-w-0 flex-1 animate-pulse rounded-md motion-reduce:animate-none" />
              <div className="bg-muted h-6 w-14 shrink-0 animate-pulse rounded-full motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
