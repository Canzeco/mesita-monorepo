import { Loader2 } from "lucide-react";

// Children-slot Suspense fallback for the discover segment. Fires the
// instant a tab (swipe / catalog / map / ai / saved) is clicked, while
// the new page's server fetch is still in flight — so the user never
// sees the previous tab's content "stuck" during navigation. The
// parent discover/layout.tsx (the DiscoverTabs strip) stays mounted;
// only this fallback swaps in for the page body until streaming
// completes.
//
// Absolute-positioned for the same reason as (shell)/loading.tsx: a
// flow-positioned flex-1 would briefly displace BottomNav during the
// children unmount/remount cycle on mobile Safari.
export default function DiscoverLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}
