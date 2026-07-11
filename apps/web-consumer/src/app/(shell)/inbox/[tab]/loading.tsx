import { Skeleton, SkeletonRow } from "@/components/shared/Skeleton";

// In-band route skeleton for /inbox/[tab]: the page awaits a server-side
// auth round trip before NotificationsClient renders, so mirror its frame —
// eyebrow + title, segment tabs, then notification-card rows.
export default function InboxTabLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-6" aria-hidden>
      <header className="pt-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="mt-1.5 h-6 w-44" />
      </header>

      <div className="border-border bg-card mt-3 grid grid-cols-2 gap-1 rounded-lg border p-1">
        <Skeleton className="h-8 rounded-md" />
        <Skeleton className="bg-muted/50 h-8 rounded-md" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow
            key={i}
            className="border-border bg-card rounded-2xl border"
          />
        ))}
      </div>
    </div>
  );
}
