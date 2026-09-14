// Menus is one card: a heading, an add row, and the menu tiles. Next 16 keeps
// the OLD screen painted when a route has no loading boundary of its own, and
// the inherited `places/[id]/loading.tsx` is Profile's photo band — the shift
// this file prevents.
export default function MenusLoading() {
  return (
    <>
      <span className="sr-only">Loading menus…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="border-border overflow-hidden rounded-2xl border p-4">
          <div className="bg-muted h-5 w-40 animate-pulse rounded-md motion-reduce:animate-none" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="bg-muted h-[132px] animate-pulse rounded-xl motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
