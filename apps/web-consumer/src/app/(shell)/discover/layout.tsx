import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/shared";
import { DiscoverModeNav } from "@/components/consumer/discover/DiscoverModeNav";
import { HomeDeckBoundary } from "@/components/consumer/home/HomeDeckBoundary";

export const dynamic = "force-dynamic";

// Discover's shared frame: the mode rail, then the active mode, over ONE
// server-fetched recommendation deck.
//
// The deck is fetched once by HomeDeckBoundary and handed to every mode
// through context. Because Next keeps a shared layout mounted across sibling
// navigations, switching modes never re-runs the fetch — Swipe, Chat and Favs
// all read the same rows. The rail paints immediately; only the content area
// waits on the deck.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block. SwipeDeck, FavoritesList
// and the map all ask for `min-h-0 flex-1`, and a block parent makes that
// inert — the scroller sizes to content and the frame clips under the tab bar.
export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DiscoverModeNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Suspense
          fallback={
            <div className="min-h-0 flex-1 p-4">
              <Skeleton className="h-full w-full rounded-2xl" />
            </div>
          }
        >
          <HomeDeckBoundary>{children}</HomeDeckBoundary>
        </Suspense>
      </div>
    </div>
  );
}
