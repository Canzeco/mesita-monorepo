import { Loader2 } from "lucide-react";

// Children-slot Suspense fallback for the discover segment. Fires the
// instant a tab (swipe / catalog / map / ai / saved) is clicked, while
// the new page's server fetch is still in flight — so the user never
// sees the previous tab's content "stuck" during navigation. The
// parent discover/layout.tsx (the DiscoverTabs strip) stays mounted;
// only this fallback swaps in for the page body until streaming
// completes.
//
// Full-height flex centering inside the discover body region keeps the
// spinner exactly centered in the visible content area while tabs stay
// mounted above.
export default function DiscoverLoading() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}
