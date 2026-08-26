import { Suspense, type ReactNode } from "react";
import { DeckSkeleton } from "@/components/consumer/DeckSkeleton";
import { HomeModeNav } from "@/components/consumer/home/HomeModeNav";
import { HomeDeckBoundary } from "@/components/consumer/home/HomeDeckBoundary";

export const dynamic = "force-dynamic";

// /home shared layout. Owns the two things every sub-route (swipe / catalog /
// chat / social / favorites) shares: the mode pill nav and the ONE server-fetched
// recommendation deck. Because Next keeps a shared layout mounted across
// sibling navigations, switching tabs never re-runs the deck fetch.
//
// The nav renders immediately; the deck fetch (HomeDeckBoundary) is Suspense'd
// with a deck skeleton so only the content area waits.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block (same class as
// inbox/layout.tsx, 2026-08-20). CatalogRails / FavoritesList / EmptyState
// all ask for `flex-1 overflow-y-auto`. A block parent makes that inert, so
// the scroller sizes to content, the frame clips, and later rails (Korean
// under Rooftops) sit under the bottom nav with no way to reach them.
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="from-background to-muted/30 flex h-full min-h-0 flex-col bg-gradient-to-b">
      <HomeModeNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
    </div>
  );
}
