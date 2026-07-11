import { Suspense, type ReactNode } from "react";
import { DeckSkeleton } from "@/components/consumer/DeckSkeleton";
import { HomeModeNav } from "@/components/consumer/home/HomeModeNav";
import { HomeDeckBoundary } from "@/components/consumer/home/HomeDeckBoundary";

export const dynamic = "force-dynamic";

// /home shared layout. Owns the two things every sub-route (swipe / ai /
// social / favorites) shares: the mode pill nav and the ONE server-fetched
// recommendation deck. Because Next keeps a shared layout mounted across
// sibling navigations, switching tabs never re-runs the deck fetch.
//
// The nav renders immediately; the deck fetch (HomeDeckBoundary) is Suspense'd
// with a deck skeleton so only the content area waits.
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="from-background to-muted/30 flex h-full min-h-0 flex-col bg-gradient-to-b">
      <HomeModeNav />
      <Suspense
        fallback={
          <div className="min-h-0 flex-1 overflow-hidden">
            <DeckSkeleton />
          </div>
        }
      >
        <HomeDeckBoundary>{children}</HomeDeckBoundary>
      </Suspense>
    </div>
  );
}
