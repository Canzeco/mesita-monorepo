// Account had no loading boundary either, for the same reason and with the
// same effect: no boundary means the router holds the old screen and the click
// looks ignored (MESITA-1729). See organization/loading.tsx for the mechanism.
//
// Shorter than Organization's on purpose. This page is a heading, the signed-in
// email, and the caller's organization memberships — one card, not two.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading account…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-40 animate-pulse rounded" />
        <div className="bg-muted h-4 w-56 animate-pulse rounded" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
