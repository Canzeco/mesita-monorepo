import { Loader2 } from "lucide-react";

// Children-slot Suspense fallback for the (shell) segment. Fires when
// the underlying surface for a soft-nav (e.g. tapping a venue card →
// /venues/[id]) is still in flight, plus on the rare first-paint of a
// hard nav into one of the bottom-nav surfaces.
//
// Critical layout choice: `absolute inset-0` (relative to the body
// wrapper, which the shell layout marks `relative`). A flow-positioned
// flex-1 fallback would still take its row in the body's flex-col,
// which on mobile Safari briefly reflowed BottomNav during the
// children unmount → loading.tsx mount → children remount sequence.
// Absolute means the body wrapper keeps its existing flex layout
// untouched while the spinner overlays it.
export default function ConsumerShellLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}
