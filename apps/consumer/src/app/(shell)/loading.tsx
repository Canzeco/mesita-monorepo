import { Loader2 } from "lucide-react";

// Children-slot Suspense fallback for the (shell) segment. Fires when
// the underlying surface for a soft-nav (e.g. tapping a venue card →
// /venues/[id]) is still in flight, plus on the rare first-paint of a
// hard nav into one of the bottom-nav surfaces.
//
// Full-height flex centering inside the shell body band. This keeps the
// spinner vertically centered in the visible content region (between top
// and bottom chrome) during route transitions.
export default function ConsumerShellLoading() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}
