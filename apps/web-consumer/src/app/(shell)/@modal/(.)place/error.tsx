"use client";

import { PlaceRouteError } from "@/components/consumer/PlaceRouteError";
import { useSlideOverClose } from "@/components/consumer/overlay/SlideOverShell";

// Inside the panel ../(.)place/layout.tsx mounts. Without it the throw reaches
// (shell)/error.tsx, drawn in the modal host where nothing takes a tap
// (MESITA-4917).
export default function PlaceModalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <PlaceRouteError error={error} retry={retry} onBack={useSlideOverClose()} />;
}
