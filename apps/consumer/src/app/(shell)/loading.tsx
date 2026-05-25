import { Loader2 } from "lucide-react";

// Top-of-shell Suspense boundary. Catches navigations between the bottom-
// nav surfaces (discover ↔ saved ↔ profile ↔ qr) so the destination's
// SSR fetch can run while the user sees a spinner instead of the
// previous page. discover has its own deeper loading.tsx that intercepts
// tab swaps inside the discover subtree.
export default function ConsumerShellLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}
