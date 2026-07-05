import { Skeleton } from "@/components/shared";

// /me/[tab] Suspense fallback. Without it, hard-navving into the Profile tab
// showed the generic shell spinner (LoadingFill) for the server render, THEN
// ProfileClient mounted and swapped in its own hero skeleton — two loading
// frames, and the odd tab out (Home/Search/Rewards all skeleton-load). This
// mirrors ProfileClient's silhouette (identity hero + sticky sub-tab bar) so
// the whole wait reads as one skeleton frame that resolves into the content.
export default function MeTabLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        {/* Identity hero: story-ring avatar + 3 stats, name/meta lines, actions.
            Matches ProfileHero's own loading branch. */}
        <header className="px-5 pt-5">
          <div className="flex items-center gap-5">
            <Skeleton className="h-[86px] w-[86px] shrink-0 rounded-full" />
            <div className="flex flex-1 items-center justify-around">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-14 rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="mt-4 h-5 w-40 rounded" />
          <Skeleton className="mt-2 h-3.5 w-28 rounded" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 flex-1 rounded-xl" />
          </div>
        </header>

        {/* Sticky Class / Settings sub-tab bar. */}
        <div className="px-4 pt-3 pb-2">
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>

        {/* Tab body: a couple of settings/class rows. */}
        <div className="flex flex-col gap-3 px-5 pt-3 pb-8">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
