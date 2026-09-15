// Pay is a one-line summary and the place's single Mesita Pay rung. Next 16
// keeps the OLD screen painted when a route has no loading boundary of its
// own, and the inherited `places/[id]/loading.tsx` is Profile's photo band —
// the shift this file prevents.
export default function PayLoading() {
  return (
    <>
      <span className="sr-only">Loading Mesita Pay…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="bg-muted h-5 w-4/5 max-w-xl animate-pulse rounded-md motion-reduce:animate-none" />
        <div className="border-border overflow-hidden rounded-2xl border px-4 py-3">
          <div className="bg-muted h-10 animate-pulse rounded-md motion-reduce:animate-none" />
        </div>
      </div>
    </>
  );
}
