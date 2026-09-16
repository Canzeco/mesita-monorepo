// Rewards is a one-line summary, the Visit Rewards rung and the Partnership
// body beneath it. Next 16 keeps the OLD screen painted when a route has no
// loading boundary of its own, and the inherited `places/[id]/loading.tsx` is
// Profile's photo band — the shift this file prevents.
export default function RewardsLoading() {
  return (
    <>
      <span className="sr-only">Loading rewards…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="bg-muted h-5 w-4/5 max-w-xl animate-pulse rounded-md motion-reduce:animate-none" />
        <div className="border-border overflow-hidden rounded-2xl border px-4 py-3">
          <div className="bg-muted h-10 animate-pulse rounded-md motion-reduce:animate-none" />
        </div>
        <div className="border-border overflow-hidden rounded-2xl border px-4 py-5">
          <div className="bg-muted h-24 animate-pulse rounded-md motion-reduce:animate-none" />
        </div>
      </div>
    </>
  );
}
