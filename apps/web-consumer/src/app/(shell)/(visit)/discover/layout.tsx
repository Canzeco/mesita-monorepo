import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/shared";
import { HomeDeckBoundary } from "@/components/consumer/home/HomeDeckBoundary";
import { HOME_MODES, ModeRail } from "@/components/consumer/ModeRail";

export const dynamic = "force-dynamic";

// The deck frame for Visit's Home, Chat and Favs pills: ONE server-fetched
// recommendation deck, shared through context. The rail itself is drawn one
// level up by (visit)/layout.tsx (MESITA-2050), because Search and Pay sit on
// the same rail and live outside /discover.
//
// Because Next keeps a shared layout mounted across sibling navigations,
// switching between Home, Chat and Favs never re-runs the fetch — all three
// read the same rows. Only the content area waits on the deck.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block. ScrollDeck and
// FavoritesList both ask for `min-h-0 flex-1`, and a block parent makes that
// inert — the scroller sizes to content and the frame clips under the tab bar.
export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ModeRail modes={HOME_MODES} />
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
