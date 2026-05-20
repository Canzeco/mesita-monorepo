import { Loader2 } from "lucide-react";

// Route-level Suspense boundary. Next.js mounts this the instant a tab
// (swipe / catalog / map / ai) is clicked, while the new page's server
// fetch is still in flight — so the user never sees the previous tab's
// content "stuck" during navigation. The parent discover/layout.tsx
// (header + tab strip) stays mounted; only this fallback swaps in for
// the page body until streaming completes.
export default function DiscoverLoading() {
  return (
    <div className="flex h-full flex-1 items-center justify-center px-6 py-12">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}
