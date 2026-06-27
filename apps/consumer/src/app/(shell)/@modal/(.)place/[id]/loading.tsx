import { Loader2 } from "lucide-react";

// Route-scoped loading fallback for the intercepted place-detail modal.
// Keep this intentionally minimal: while the place detail EF is in flight,
// render only a centered spinner (no miniature skeleton/preload content).

export default function PlaceModalLoading() {
  return (
    <div className="bg-background pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center">
      <Loader2
        className="text-muted-foreground h-6 w-6 animate-spin"
        aria-label="Loading place"
      />
    </div>
  );
}
