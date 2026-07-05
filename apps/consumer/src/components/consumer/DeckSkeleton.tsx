import { Skeleton } from "@/components/shared";

// Deck-shaped loading silhouette shared by the /home and /explore/swipe
// loading boundaries. Mirrors SwipeDeck's real layout — px-3 pt-2 pb-3
// band, one full-bleed rounded-3xl card filling the flex slot, then the
// five-action h-12 button row — so the deck appears to "arrive" in place
// instead of blinking through a centered spinner.
export function DeckSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col px-3 pt-2 pb-3">
      <Skeleton className="min-h-0 w-full flex-1 rounded-3xl" />
      <div className="mt-3 flex items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 flex-1 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
