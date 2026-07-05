import { Skeleton } from "@/components/shared";
import { DeckSkeleton } from "@/components/consumer/DeckSkeleton";

// /home Suspense fallback. The page server-fetches the recommendation deck
// (consumer-recommend-swipe → public catalog fallback), which can take a
// beat — mirror HomeHub's silhouette meanwhile: the sticky mode-pill band
// on top (the shell renders no TopBar for /home, so this band IS the top
// chrome) and the swipe deck below.
export default function HomeLoading() {
  return (
    <div className="from-background to-muted/30 flex h-full min-h-0 flex-col bg-gradient-to-b">
      {/* Mode pill nav band (Social / Swipe / Favorites). */}
      <div className="border-border bg-background/90 shrink-0 border-b">
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 flex-1 rounded-full" />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <DeckSkeleton />
      </div>
    </div>
  );
}
