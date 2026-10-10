import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/shared";
import { HomeDeckBoundary } from "@/components/consumer/home/HomeDeckBoundary";
import { ModeRail } from "@/components/consumer/ModeRail";

export const dynamic = "force-dynamic";

// The deck frame for Home's four pills — Home, Scroll, Chat and Favs: the
// rail, then ONE server-fetched recommendation deck shared through context.
// The rail is drawn HERE, not in the route-group layout above, so Search
// (its own bottom tab, outside /discover) never gets a rail over its map.
//
// Because Next keeps a shared layout mounted across sibling navigations,
// switching between Home, Scroll, Chat and Favs never re-runs the fetch — all
// four read the same rows. Only the content area waits on the deck.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block. ScrollDeck and
// FavoritesList both ask for `min-h-0 flex-1`, and a block parent makes that
// inert — the scroller sizes to content and the frame clips under the tab bar.
export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ModeRail />
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
  );
}
