import { headers } from "next/headers";

import {
  PlaceSlideOverSkeleton,
  ReservationSlideOverSkeleton,
} from "@/components/consumer/overlay/DetailSkeletons";
import { routeFor } from "@/lib/consumer-route-contract";
import { GeneratingPlaceScreen } from "@/components/consumer/GeneratingPlace";
import { SlideOverShell } from "@/components/consumer/overlay/SlideOverShell";

// Slot-level fallback: the first frame a place or reservation open
// paints, before the modal segment's own layout and loading arrive. It was a
// dim scrim with a spinner, so every open went spinner → skeleton (Pato,
// MESITA-2840: "why spinning and then placeholder, don't do that"). It now
// draws what the segment will draw, its shell around its skeleton, picked by
// the bare path (the proxy's x-pathname names the target on a
// navigation's request), so the open lands in one step (MESITA-2848).
export default async function ModalLoading() {
  const id = routeFor((await headers()).get("x-pathname") ?? "");
  if (id === "placeOpen") {
    return (
      <SlideOverShell>
        <GeneratingPlaceScreen variant="modal" />
      </SlideOverShell>
    );
  }
  if (id === "place") {
    return (
      <SlideOverShell>
        <PlaceSlideOverSkeleton />
      </SlideOverShell>
    );
  }
  if (id === "reservation") {
    return (
      <SlideOverShell>
        <ReservationSlideOverSkeleton />
      </SlideOverShell>
    );
  }
  return null;
}
