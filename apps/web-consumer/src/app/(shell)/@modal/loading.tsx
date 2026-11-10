import { headers } from "next/headers";

import {
  PlaceSlideOverSkeleton,
  ReservationSlideOverSkeleton,
} from "@/components/consumer/overlay/DetailSkeletons";
import { CONSUMER_ROUTES as R } from "@/lib/consumer-route-contract";
import { GeneratingPlaceScreen } from "@/components/consumer/GeneratingPlace";
import { RouteSheetShell } from "@/components/consumer/overlay/RouteSheetShell";
import { SlideOverShell } from "@/components/consumer/overlay/SlideOverShell";
import AskAiSheetPage from "./(.)search/chat/page";

// Slot-level fallback: the first frame a place, reservation or Ask AI open
// paints, before the modal segment's own layout and loading arrive. It was a
// dim scrim with a spinner, so every open went spinner → skeleton (Pato,
// MESITA-2840: "why spinning and then placeholder, don't do that"). It now
// draws what the segment will draw, its shell around its skeleton, picked by
// the bare path (the proxy's x-pathname names the target on a
// navigation's request), so the open lands in one step (MESITA-2848).
export default async function ModalLoading() {
  const bare = (await headers()).get("x-pathname") ?? "";
  if (bare.startsWith(R.placeOpen.prefix)) {
    return (
      <SlideOverShell>
        <GeneratingPlaceScreen variant="modal" />
      </SlideOverShell>
    );
  }
  if (bare.startsWith(R.place.prefix)) {
    return (
      <SlideOverShell>
        <PlaceSlideOverSkeleton />
      </SlideOverShell>
    );
  }
  if (bare.startsWith(R.reservation.prefix)) {
    return (
      <SlideOverShell>
        <ReservationSlideOverSkeleton />
      </SlideOverShell>
    );
  }
  if (bare === R.searchChat) {
    return (
      <RouteSheetShell ariaLabel="Ask AI">
        <AskAiSheetPage />
      </RouteSheetShell>
    );
  }
  return null;
}
