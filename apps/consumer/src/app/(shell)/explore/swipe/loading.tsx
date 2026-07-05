import { DeckSkeleton } from "@/components/consumer/DeckSkeleton";

// /explore/swipe Suspense fallback. Same server fetch as /home (the
// recommender deck), same destination silhouette — SwipeDeck fills the
// shell body directly here, so the deck skeleton stands alone.
export default function ExploreSwipeLoading() {
  return <DeckSkeleton />;
}
