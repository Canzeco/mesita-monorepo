import { LoadingFill } from "@/components/shared";

// Children-slot Suspense fallback for the (shell) segment. Fires when
// the underlying surface for a soft-nav (e.g. tapping a place card →
// /places/[id]) is still in flight, plus on the rare first-paint of a
// hard nav into one of the bottom-nav surfaces.
//
// Full-height flex centering inside the shell body band. This keeps the
// spinner vertically centered in the visible content region (between top
// and bottom chrome) during route transitions.
export default function ConsumerShellLoading() {
  return <LoadingFill className="bg-background" />;
}
