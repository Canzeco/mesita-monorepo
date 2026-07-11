import { Skeleton } from "@/components/shared";

// /share (referral) Suspense fallback — mirror the page silhouette: five
// standard-size gift cards (eyebrow + Share pill on top, title + line at the
// bottom) so it skeleton-loads like Home / Search / Rewards / Reservations /
// Me instead of the shell-level LoadingFill spinner.
export default function ShareLoading() {
  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 pt-4 pb-6">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border-border bg-card flex min-h-[150px] flex-col justify-between rounded-2xl border p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <div className="pt-6">
              <Skeleton className="h-6 w-40 rounded" />
              <Skeleton className="mt-2 h-3.5 w-56 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
